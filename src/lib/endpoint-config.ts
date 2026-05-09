import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

interface EndpointsConfig {
    api: {
        base_url: string;
        prefix: string;
    };
}

let config: EndpointsConfig | null = null;

function loadConfig(): EndpointsConfig {
    if (config) {
        return config;
    }
    const configPath = path.resolve(process.cwd(), 'endpoints.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents) as EndpointsConfig;
    return config;
}

export function getApiUrl(): string {
    const {api} = loadConfig();
    return `${api.base_url}${api.prefix}`;
}

