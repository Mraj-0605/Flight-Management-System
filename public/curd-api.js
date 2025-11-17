// API Client for PostgreSQL Backend
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('authToken');

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

// Auth API
const AuthAPI = {
    async login(email, password) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        authToken = data.token;
        localStorage.setItem('authToken', data.token);
        return data;
    },

    async register(email, password, name, role) {
        return apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, role })
        });
    },

    async getCurrentUser() {
        return apiRequest('/auth/me');
    },

    logout() {
        localStorage.removeItem('authToken');
        authToken = null;
        window.location.href = 'login.html';
    }
};

// Stats API
const StatsAPI = {
    async getStats() {
        return apiRequest('/stats');
    }
};

// Fleet API
const FleetAPI = {
    async getAll() {
        return apiRequest('/fleet');
    },

    async getById(id) {
        return apiRequest(`/fleet/${id}`);
    },

    async create(data) {
        return apiRequest('/fleet', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return apiRequest(`/fleet/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return apiRequest(`/fleet/${id}`, { method: 'DELETE' });
    }
};

// Flights API
const FlightsAPI = {
    async getAll(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return apiRequest(`/flights${queryString ? '?' + queryString : ''}`);
    },

    async getById(id) {
        return apiRequest(`/flights/${id}`);
    },

    async create(data) {
        return apiRequest('/flights', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return apiRequest(`/flights/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return apiRequest(`/flights/${id}`, { method: 'DELETE' });
    },

    async updateCrewManifest(id, crewManifest) {
        return apiRequest(`/flights/${id}/crew`, {
            method: 'PUT',
            body: JSON.stringify({ crewManifest })
        });
    }
};

// Crew API
const CrewAPI = {
    async getAll() {
        return apiRequest('/crew');
    },

    async getById(id) {
        return apiRequest(`/users/${id}`);
    },

    async create(data) {
        return apiRequest('/crew', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return apiRequest(`/crew/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return apiRequest(`/crew/${id}`, { method: 'DELETE' });
    }
};

// Bookings API
const BookingsAPI = {
    async getAll() {
        // This is still useful for the admin dashboard
        return apiRequest('/bookings');
    },

    // ADD THIS FUNCTION
    async getMyBookings() {
        // This calls the same endpoint, but the server now knows to filter by user
        return apiRequest('/bookings');
    },

    async getById(id) {
        return apiRequest(`/bookings/${id}`);
    },

    async create(data) {
        return apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return apiRequest(`/bookings/${id}`, { method: 'DELETE' });
    }
};

// Invites API
const InvitesAPI = {
    async getAll() {
        return apiRequest('/invites');
    },

    async create(email, role) {
        return apiRequest('/invites', {
            method: 'POST',
            body: JSON.stringify({ email, role })
        });
    },

    async resend(id) {
        return apiRequest(`/invites/${id}/resend`, { method: 'PUT' });
    },

    async delete(id) {
        return apiRequest(`/invites/${id}`, { method: 'DELETE' });
    }
};

// Analytics API
const AnalyticsAPI = {
    async getFlightStats() {
        return apiRequest('/analytics/flights');
    },

    async getFleetStats() {
        return apiRequest('/analytics/fleet');
    }
};
