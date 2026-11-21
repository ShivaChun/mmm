const PROJECTS_KEY = 'yra_saved_projects_v1';
const DESIGNER_KEY = 'yra_designer_profile_v1';
const MAX_SAVED_PROJECTS = 12;

export const DEFAULT_DESIGNER = {
    name: '',
    firm: 'YRA 建築設計事務所',
    contact: ''
};

export function loadSavedProjects() {
    try {
        const raw = localStorage.getItem(PROJECTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveProjectSnapshot(project) {
    try {
        if (!project || !project.id) return [];
        const list = loadSavedProjects();
        const filtered = list.filter(p => p.id !== project.id);
        const next = [project, ...filtered].slice(0, MAX_SAVED_PROJECTS);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
        return next;
    } catch {
        return loadSavedProjects();
    }
}

export function deleteSavedProject(projectId) {
    try {
        const list = loadSavedProjects().filter(p => p.id !== projectId);
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
        return list;
    } catch {
        return [];
    }
}

export function loadDesignerProfile() {
    try {
        const raw = localStorage.getItem(DESIGNER_KEY);
        if (!raw) return { ...DEFAULT_DESIGNER };
        return { ...DEFAULT_DESIGNER, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_DESIGNER };
    }
}

export function saveDesignerProfile(profile) {
    try {
        localStorage.setItem(DESIGNER_KEY, JSON.stringify(profile));
    } catch {
        // ignore storage quota errors
    }
}

// UTF-8 安全的 Base64 URL 編碼，用於 GitHub Pages 純前端唯讀分享連結
export function encodeSharePayload(payload) {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharePayloadFromHash() {
    try {
        if (typeof window === 'undefined') return null;
        const hash = window.location.hash || '';
        const match = hash.match(/share=([A-Za-z0-9\-_]+)/);
        if (!match) return null;
        let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const json = new TextDecoder().decode(bytes);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function buildReadOnlyShareUrl(payload) {
    const token = encodeSharePayload(payload);
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#share=${token}`;
}
