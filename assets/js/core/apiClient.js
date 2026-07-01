import { getAccessToken, refresh, logout } from './_auth.js';

export async function apiRequest(url, options = {}) {
    let token = getAccessToken();

    let response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
        const newToken = await refresh();

        if (newToken) {
            response = await fetch(url, {
                ...options,
                credentials: 'include',
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${newToken}`,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            await logout();
            window.location.href = `${window.location.origin}/v2/login.html`;
        }
    }

    return response;
}