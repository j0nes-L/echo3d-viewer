function getApiBase(): string {
    return '/api';
}

let apiKey = '';

export function setApiKey(key: string): void {
    apiKey = key;
}

export function getApiKey(): string {
    return apiKey;
}

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    return headers;
}

export type UserRole = 'admin' | 'viewer';

export interface LoginResult {
    ok: boolean;
    role: UserRole | null;
}

export async function login(password: string): Promise<LoginResult> {
    const res = await fetch(`${getApiBase()}/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...authHeaders()},
        body: JSON.stringify({password}),
    });
    if (res.status === 401) return {ok: false, role: null};
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    if (data.authenticated !== true) return {ok: false, role: null};
    const role: UserRole = data.role === 'admin' ? 'admin' : 'viewer';
    return {ok: true, role};
}

export interface CaptureListItem {
    id: string;
    folder: string;
    raw_images: number;
    preprocessed_images: number;
}

export interface CaptureDetail {
    id: string;
    folder: string;
    raw_images: string[];
    preprocessed_images: string[];
    pointclouds: string[];
}

export interface PointCloudInfo {
    filename: string;
    size_bytes: number;
    url: string;
}

export interface PointCloudsResponse {
    capture_id: string;
    pointclouds: PointCloudInfo[];
    chunks: PointCloudInfo[];
    draco_chunks: PointCloudInfo[];
    colmap_available?: boolean;
    colmap_url?: string | null;
    colmap_size_bytes?: number | null;
}

export interface ResolvedPointCloud {
    view: PointCloudInfo;
    download: PointCloudInfo;
    colmap_available: boolean;
    colmap_url: string | null;
    colmap_size_bytes: number | null;
    mesh_available: boolean;
    mesh_size_bytes: number | null;
}

export function resolvePointCloud(resp: PointCloudsResponse): ResolvedPointCloud | null {
    const ply = resp.pointclouds.find(p => p.filename.endsWith('.ply'));
    if (!ply) return null;
    return {
        view: ply,
        download: ply,
        colmap_available: !!resp.colmap_available,
        colmap_url: resp.colmap_url || null,
        colmap_size_bytes: resp.colmap_size_bytes || null,
        mesh_available: false,
        mesh_size_bytes: null,
    };
}

export async function checkMeshAvailability(captureId: string): Promise<{
    available: boolean;
    size_bytes: number | null
}> {
    const cached = meshInfoCache.get(captureId);
    if (cached) return cached;

    const inflight = meshInfoInflight.get(captureId);
    if (inflight) return inflight;

    const p = (async () => {
        try {
            const res = await fetch(
                `${getApiBase()}/get-mesh-info?capture_id=${captureId}`,
                {headers: authHeaders()},
            );
            if (!res.ok) return {available: false, size_bytes: null};
            const data = await res.json() as { available?: boolean; size_bytes?: number | null };
            const result = {
                available: !!data.available,
                size_bytes: typeof data.size_bytes === 'number' ? data.size_bytes : null,
            };
            meshInfoCache.set(captureId, result);
            return result;
        } catch {
            return {available: false, size_bytes: null};
        } finally {
            meshInfoInflight.delete(captureId);
        }
    })();

    meshInfoInflight.set(captureId, p);
    return p;
}

const meshInfoCache = new Map<string, { available: boolean; size_bytes: number | null }>();
const meshInfoInflight = new Map<string, Promise<{ available: boolean; size_bytes: number | null }>>();

export function getCachedMeshInfo(captureId: string): { available: boolean; size_bytes: number | null } | null {
    return meshInfoCache.get(captureId) ?? null;
}

export function clearMeshInfoCache(captureId?: string): void {
    if (captureId) {
        meshInfoCache.delete(captureId);
        meshInfoInflight.delete(captureId);
    } else {
        meshInfoCache.clear();
        meshInfoInflight.clear();
    }
}

export async function fetchMeshGlb(
    captureId: string,
    onProgress?: (fraction: number) => void,
    knownTotalBytes?: number | null,
): Promise<ArrayBuffer> {
    const res = await fetch(
        `${getApiBase()}/get-mesh?capture_id=${captureId}`,
        {headers: authHeaders()},
    );
    if (!res.ok) throw new Error(`Failed to download mesh: ${res.status}`);

    const clHeader = res.headers.get('Content-Length') || res.headers.get('X-Content-Length');
    const total = clHeader ? parseInt(clHeader, 10) : (knownTotalBytes || 0);

    if (!onProgress || !total || !res.body) {
        return res.arrayBuffer();
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received / total);
    }

    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        buf.set(chunk, offset);
        offset += chunk.length;
    }
    return buf.buffer;
}

export async function deleteCapture(captureId: string): Promise<void> {
    const res = await fetch(`${getApiBase()}/captures/${captureId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete capture: ${res.status}`);
    pointCloudsRespCache.delete(captureId);
}

export async function fetchCaptures(): Promise<CaptureListItem[]> {
    const res = await fetch(`${getApiBase()}/get-captures`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch captures: ${res.status}`);
    const data = await res.json();
    return data.captures;
}

export async function fetchCaptureDetail(captureId: string): Promise<CaptureDetail> {
    const res = await fetch(`${getApiBase()}/captures/${captureId}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch capture detail: ${res.status}`);
    return res.json();
}

const pointCloudsRespCache = new Map<string, PointCloudsResponse>();

export function clearPointCloudsCache(captureId?: string): void {
    if (captureId) pointCloudsRespCache.delete(captureId);
    else pointCloudsRespCache.clear();
    clearMeshInfoCache(captureId);
}

export async function fetchPointClouds(captureId: string, forceRefresh = false): Promise<PointCloudsResponse> {
    if (!forceRefresh) {
        const cached = pointCloudsRespCache.get(captureId);
        if (cached) return cached;
    }
    const res = await fetch(`${getApiBase()}/get-pointclouds-info?capture_id=${captureId}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch point clouds: ${res.status}`);
    const data = await res.json() as PointCloudsResponse;
    pointCloudsRespCache.set(captureId, data);
    return data;
}

export async function fetchPointCloudData(
    captureId: string,
    filename: string,
    onProgress?: (fraction: number) => void,
    knownTotalBytes?: number | null,
): Promise<ArrayBuffer> {
    const res = await fetch(
        `${getApiBase()}/get-pointcloud?capture_id=${captureId}&filename=${filename}`,
        {headers: authHeaders()},
    );
    if (!res.ok) throw new Error(`Failed to download point cloud: ${res.status}`);

    const clHeader = res.headers.get('Content-Length') || res.headers.get('X-Content-Length');
    const total = clHeader ? parseInt(clHeader, 10) : (knownTotalBytes || 0);

    if (!onProgress || !total || !res.body) {
        return res.arrayBuffer();
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received / total);
    }

    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        buf.set(chunk, offset);
        offset += chunk.length;
    }
    return buf.buffer;
}

export async function fetchColmapZip(
    captureId: string,
    onProgress?: (fraction: number) => void,
    knownTotalBytes?: number | null,
): Promise<ArrayBuffer> {
    const res = await fetch(
        `${getApiBase()}/get-colmap?capture_id=${captureId}`,
        {headers: authHeaders()},
    );
    if (!res.ok) throw new Error(`Failed to download COLMAP zip: ${res.status}`);

    const clHeader = res.headers.get('Content-Length') || res.headers.get('X-Content-Length');
    const total = clHeader ? parseInt(clHeader, 10) : (knownTotalBytes || 0);

    if (!onProgress || !total || !res.body) {
        return res.arrayBuffer();
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received / total);
    }

    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        buf.set(chunk, offset);
        offset += chunk.length;
    }
    return buf.buffer;
}
