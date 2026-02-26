<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const secret = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();

const login = async () => {
    if (!secret.value) return;
    loading.value = true;
    error.value = '';
    
    try {
        const response = await fetch('http://localhost:6671/admin/login', {
            method: 'POST',
            headers: {
                'X-Admin-Secret': secret.value
            }
        });
        
        if (response.ok) {
            localStorage.setItem('admin_secret', secret.value);
            router.push('/');
        } else {
            error.value = 'Invalid admin password.';
        }
    } catch (e) {
        error.value = 'Cannot connect to server.';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
<div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md">
        <div class="text-center mb-8">
            <div class="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h1 class="text-3xl font-extrabold text-gray-900">Admin Login</h1>
            <p class="text-gray-500 mt-2 text-sm">Please enter the administrator password to continue.</p>
        </div>
        
        <form @submit.prevent="login" class="space-y-6">
            <div>
                <input v-model="secret" type="password" placeholder="Admin Password" class="w-full border-gray-300 shadow-sm p-4 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
            </div>
            <p v-if="error" class="text-rose-500 text-sm font-semibold text-center">{{ error }}</p>
            <button type="submit" :disabled="loading" class="w-full bg-indigo-600 text-white font-bold p-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-70 flex justify-center items-center">
                <span v-if="!loading">Sign In</span>
                <span v-else class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            </button>
        </form>
    </div>
</div>
</template>
