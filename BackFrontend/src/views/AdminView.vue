<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface APIKey {
    id: number;
    key_value: string;
    user_identifier: string;
    eldorado_email: string | null;
    expiry_date: string | null;
    created_at: string;
    last_used_at: string | null;
    usage_count: number;
    status: string;
}

const keys = ref<APIKey[]>([]);
const newUser = ref('');
const newDays = ref<number | null>(30);
const loading = ref(false);

const llmKey = ref('');
const llmStatus = ref('');
const llmLoading = ref(false);

const oldPassword = ref('');
const newPassword = ref('');
const showPasswordModal = ref(false);
const passwordMessage = ref('');

const API_URL = 'http://localhost:6671/admin/keys';
const CONFIG_URL = 'http://localhost:6671/admin/config';
const ADMIN_SECRET = localStorage.getItem('admin_secret') || '';

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
        ...options.headers,
        'X-Admin-Secret': ADMIN_SECRET
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 403) {
        logout();
    }
    return res;
};

const fetchKeys = async () => {
    loading.value = true;
    try {
        const res = await apiFetch(API_URL);
        if (res.ok) keys.value = await res.json();
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const fetchConfig = async () => {
    try {
        const res = await apiFetch(CONFIG_URL);
        if (res.ok) {
            const configs = await res.json();
            const llm = configs.find((c: any) => c.key === 'LLM_API_KEY');
            if (llm) llmKey.value = llm.value;
        }
        await checkLlmStatus();
    } catch(e) {
        console.error(e);
    }
}

const checkLlmStatus = async () => {
    llmLoading.value = true;
    try {
        const res = await apiFetch('http://localhost:6671/admin/llm-status');
        if (res.ok) {
            const data = await res.json();
            llmStatus.value = data.message;
        }
    } catch(e) {
        llmStatus.value = "Check failed";
    } finally {
        llmLoading.value = false;
    }
}

const saveLlmConfig = async () => {
    try {
        const res = await apiFetch(`${CONFIG_URL}/LLM_API_KEY`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: llmKey.value })
        });
        if (res.ok) {
            alert('LLM Config Saved');
            checkLlmStatus();
        }
    } catch(e) {
        console.error(e);
    }
}

const createKey = async () => {
    if (!newUser.value) return;
    
    try {
        const res = await apiFetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_identifier: newUser.value,
                days_valid: newDays.value
            })
        });
        if (res.ok) {
            newUser.value = '';
            fetchKeys();
        }
    } catch (e) {
        console.error(e);
    }
};

const updateEldoradoEmail = async (id: number, currentEmail: string | null) => {
    const newEmail = prompt('Enter new Eldorado Email for this key:', currentEmail || '');
    if (newEmail === null) return; // cancelled
    
    try {
        const res = await apiFetch(`${API_URL}/${id}`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eldorado_email: newEmail })
        });
        if (res.ok) fetchKeys();
    } catch (e) {
        console.error(e);
    }
}

const banKey = async (id: number) => {
    if (!confirm('Are you sure you want to ban this key?')) return;
    try {
        const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (res.ok) fetchKeys();
    } catch (e) {
        console.error(e);
    }
};

const changePassword = async () => {
    passwordMessage.value = '';
    if (!oldPassword.value || !newPassword.value) {
        passwordMessage.value = 'Please fill in both fields.';
        return;
    }
    
    try {
        const res = await apiFetch('http://localhost:6671/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPassword.value, new_password: newPassword.value })
        });
        
        if (res.ok) {
            passwordMessage.value = 'Success!';
            localStorage.setItem('admin_secret', newPassword.value);
            setTimeout(() => {
                showPasswordModal.value = false;
                oldPassword.value = '';
                newPassword.value = '';
                passwordMessage.value = '';
            }, 1500);
        } else {
            const data = await res.json();
            passwordMessage.value = data.detail || 'Failed to change password.';
        }
    } catch (e) {
        passwordMessage.value = 'Server error.';
    }
};

const logout = () => {
    localStorage.removeItem('admin_secret');
    window.location.href = '/login';
}

onMounted(() => {
    fetchKeys();
    fetchConfig();
});
</script>

<template>
<div class="min-h-screen bg-gray-100 p-4 sm:p-8">
    <div class="max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row justify-between items-center mb-10 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div class="flex items-center gap-4 mb-4 sm:mb-0">
                <div class="bg-primary/10 p-3 rounded-xl">
                    <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <div>
                    <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h1>
                    <p class="text-sm text-gray-500 mt-1">Manage system configurations and user access keys.</p>
                </div>
            </div>
            <div class="flex gap-3">
                <button @click="showPasswordModal = true" class="bg-white text-gray-600 hover:bg-gray-50 font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm border border-gray-200 flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                    Password
                </button>
                <button @click="logout" class="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm border border-red-100">Sign Out</button>
            </div>
        </div>

        <!-- Change Password Modal -->
        <div v-if="showPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
                <h2 class="text-2xl font-bold mb-2 text-gray-900">Security Settings</h2>
                <p class="text-gray-500 mb-6 text-sm">Update your administrator access password.</p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Current Password</label>
                        <input v-model="oldPassword" type="password" class="w-full rounded-xl border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500" placeholder="••••••••">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">New Password</label>
                        <input v-model="newPassword" type="password" class="w-full rounded-xl border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500" placeholder="••••••••">
                    </div>
                </div>

                <p v-if="passwordMessage" :class="passwordMessage === 'Success!' ? 'text-emerald-600' : 'text-rose-600'" class="mt-4 text-center font-bold text-sm">
                    {{ passwordMessage }}
                </p>

                <div class="flex gap-3 mt-8">
                    <button @click="showPasswordModal = false" class="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button @click="changePassword" class="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all">Update Now</button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- LLM Configuration -->
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        LLM Configuration
                    </h2>
                    <span class="text-xs font-bold px-3 py-1 rounded-full shadow-inner" :class="llmStatus === 'Connected successfully' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'">
                        {{ llmLoading ? 'Checking connection...' : llmStatus }}
                    </span>
                </div>
                <div class="flex-1 flex flex-col justify-center">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">API Key (iFlow / OpenAI Compatible)</label>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <input v-model="llmKey" type="text" class="flex-1 rounded-xl border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 font-mono text-sm transition-shadow" placeholder="sk-...">
                        <button @click="saveLlmConfig" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors whitespace-nowrap">Save & Test</button>
                    </div>
                    <p class="text-xs text-gray-500 mt-3">Used for analyzing images via <span class="font-mono bg-gray-100 px-1 rounded text-gray-600">qwen3-vl-plus</span>.</p>
                </div>
            </div>

            <!-- Create Key -->
            <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
                <h2 class="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                    <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                    Generate Access Key
                </h2>
                <div class="flex-1 flex flex-col justify-center gap-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">User Identifier</label>
                            <input v-model="newUser" type="text" class="block w-full rounded-xl border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-gray-50 transition-shadow" placeholder="e.g. user@example.com">
                        </div>
                        <div class="w-full sm:w-32">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Valid Days</label>
                            <input v-model="newDays" type="number" class="block w-full rounded-xl border-gray-300 shadow-sm p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-gray-50 transition-shadow" placeholder="30">
                        </div>
                    </div>
                    <button @click="createKey" class="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors mt-2">Generate New Key</button>
                </div>
            </div>
        </div>

        <!-- Key List -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
                <h3 class="text-lg font-bold text-gray-800">Active Licenses</h3>
            </div>
            
            <!-- ADDED overflow-x-auto to fix the bug -->
            <div class="overflow-x-auto w-full">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Key</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Eldorado Email</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usage</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry</th>
                            <th class="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="key in keys" :key="key.id" class="hover:bg-gray-50/50 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{{ key.id }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{{ key.user_identifier }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono bg-gray-50 rounded px-2">{{ key.key_value }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span v-if="key.eldorado_email" class="text-gray-900 font-medium">{{ key.eldorado_email }}</span>
                                <span v-else class="text-gray-400 italic">Not Bound</span>
                                <button @click="updateEldoradoEmail(key.id, key.eldorado_email)" class="ml-3 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 px-2 py-1 rounded transition-colors">Edit</button>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{{ key.usage_count }}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span :class="key.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'" class="px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full border">
                                    {{ key.status.toUpperCase() }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{{ key.expiry_date ? new Date(key.expiry_date).toLocaleDateString() : 'Permanent' }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button v-if="key.status === 'active'" @click="banKey(key.id)" class="text-rose-600 hover:text-rose-900 font-bold bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-colors">Ban</button>
                            </td>
                        </tr>
                        <tr v-if="keys.length === 0">
                            <td colspan="8" class="px-6 py-12 text-center text-gray-500 font-medium">
                                No keys generated yet.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
</template>
