<script setup lang="ts">
import { ref, onMounted } from 'vue';

const listingsData = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const uiColor = ref('#FF9500');

onMounted(() => {
    uiColor.value = localStorage.getItem('eldo_ui_color') || '#FF9500';
    fetchListings();
});

const fetchListings = async () => {
    loading.value = true;
    error.value = null;

    const authMode = localStorage.getItem('eldo_auth_mode') || 'email';
    const email = localStorage.getItem('eldo_email') || '';
    const password = localStorage.getItem('eldo_password') || '';
    const cookieStr = localStorage.getItem('eldo_cookie') || '';

    try {
        const response = await fetch('http://localhost:6675/api/listings/state-count', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                authMode,
                email,
                password,
                cookieStr
            })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            listingsData.value = data.data;
        } else {
            throw new Error(data.message || 'Failed to fetch listings');
        }
    } catch (err: any) {
        console.error(err);
        error.value = err.message;
    } finally {
        loading.value = false;
    }
};

</script>

<template>
<body class="font-display bg-primary min-h-screen flex flex-col items-center justify-center p-4 selection:bg-black selection:text-primary" :style="{ backgroundColor: uiColor }">
<header class="w-full max-w-4xl flex items-center justify-between mb-8 px-4 sm:px-0">
<router-link class="flex items-center gap-2 text-white hover:text-gray-200 transition-colors" to="/">
<span class="material-icons text-3xl">arrow_back</span>
<span class="text-lg font-medium">Home</span>
</router-link>
<h1 class="text-4xl font-bold text-white tracking-tight text-center flex-grow">My Listings</h1>
<div class="w-20"></div> 
</header>

<main class="w-full max-w-4xl bg-background-light dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden transition-colors duration-300 min-h-[50vh] p-8">
    <div v-if="loading" class="flex flex-col items-center justify-center h-full space-y-4 py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-primary" :style="{ borderColor: uiColor }"></div>
        <p class="text-gray-500 dark:text-gray-400 font-medium">Fetching listing data from Eldorado...</p>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center h-full space-y-4 py-20">
        <span class="material-icons text-red-500 text-6xl">error_outline</span>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Failed to load</h2>
        <p class="text-red-500 text-center max-w-md">{{ error }}</p>
        <button @click="fetchListings" class="mt-4 px-6 py-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-black dark:text-white rounded-lg font-medium transition-colors">
            Try Again
        </button>
    </div>

    <div v-else-if="listingsData" class="space-y-6">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span class="material-icons text-primary" :style="{ color: uiColor }">inventory_2</span>
                Offer State Counts
            </h2>
            <button @click="fetchListings" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300" title="Refresh">
                <span class="material-icons">refresh</span>
            </button>
        </div>

        <div v-if="Array.isArray(listingsData) && listingsData.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-for="(item, index) in listingsData" :key="index" class="bg-gray-50 dark:bg-zinc-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                <span class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ item.offerState || item.state || 'Unknown State' }}</span>
                <span class="text-4xl font-black text-gray-900 dark:text-white">{{ item.count !== undefined ? item.count : JSON.stringify(item) }}</span>
            </div>
        </div>
        
        <!-- Fallback if it's an object instead of array -->
        <div v-else-if="!Array.isArray(listingsData) && typeof listingsData === 'object' && Object.keys(listingsData).length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-for="(value, key) in listingsData" :key="key" class="bg-gray-50 dark:bg-zinc-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow">
                <span class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ key }}</span>
                <span class="text-4xl font-black text-gray-900 dark:text-white">{{ value }}</span>
            </div>
        </div>

        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
            No listings data found or data format unrecognized.
            <pre class="mt-4 text-left text-xs bg-gray-100 dark:bg-black p-4 rounded-lg overflow-auto">{{ listingsData }}</pre>
        </div>
    </div>
</main>
</body>
</template>
