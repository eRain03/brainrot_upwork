<script setup lang="ts">
import { ref, onMounted } from 'vue';

const descriptionTemplate = ref('');
const uiColor = ref('#FF9500');
const fontName = ref('');

onMounted(() => {
    descriptionTemplate.value = localStorage.getItem('eldo_desc_template') || '';
    uiColor.value = localStorage.getItem('eldo_ui_color') || '#FF9500';
    fontName.value = localStorage.getItem('eldo_font_name') || '';
});

const saveSettings = () => {
    localStorage.setItem('eldo_desc_template', descriptionTemplate.value);
    localStorage.setItem('eldo_ui_color', uiColor.value);
    localStorage.setItem('eldo_font_name', fontName.value);
    alert('Settings saved!');
};

</script>

<template>
<body class="font-display bg-primary min-h-screen flex flex-col items-center justify-center p-4 selection:bg-black selection:text-primary" :style="{ backgroundColor: uiColor }">
<header class="w-full max-w-4xl flex items-center justify-between mb-8 px-4 sm:px-0">
<router-link class="flex items-center gap-2 text-white hover:text-gray-200 transition-colors" to="/">
<span class="material-icons text-3xl">arrow_back</span>
<span class="text-lg font-medium">Home</span>
</router-link>
<h1 class="text-4xl font-bold text-white tracking-tight text-center flex-grow">Settings Page</h1>
<div class="w-20"></div> 
</header>
<main class="w-full max-w-4xl bg-background-light dark:bg-background-dark rounded-xl shadow-2xl overflow-hidden transition-colors duration-300">
<div class="p-8 sm:p-12 space-y-10">
<section>
<div class="flex items-center gap-3 mb-4">
<span class="material-icons text-primary text-3xl">description</span>
<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Choose custom description</h2>
</div>
<div class="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="description">
                        Listing Template
                    </label>
<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Use variables: <code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-primary">{name}</code>, <code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-primary">{mutation}</code>, <code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-primary">{trait_count}</code>
</p>
<textarea v-model="descriptionTemplate" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-primary shadow-sm resize-none" id="description" placeholder="Selling an amazing {name} with {mutation} mutation!
Trait count: {trait_count}
DM for more info. #Roblox #Trade" rows="6"></textarea>
</div>
</section>
<section>
<div class="flex items-center gap-3 mb-4">
<span class="material-icons text-primary text-3xl">palette</span>
<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Change UI color</h2>
</div>
<div class="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center gap-6">
<div>
<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="color-picker">Custom Color</label>
<div class="flex items-center gap-3">
<input v-model="uiColor" class="h-10 w-10 p-1 rounded cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600" id="color-picker" type="color"/>
<span class="text-sm font-mono text-gray-500 dark:text-gray-400">{{ uiColor }}</span>
</div>
</div>
<div class="h-10 w-px bg-gray-200 dark:bg-gray-600 hidden sm:block"></div>
<div>
<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Presets</span>
<div class="flex gap-4">
<button @click="uiColor='#3B82F6'" aria-label="Blue Preset" class="w-10 h-10 rounded-full bg-blue-500 hover:ring-4 ring-blue-200 dark:ring-blue-900 transition-all focus:outline-none"></button>
<button @click="uiColor='#A855F7'" aria-label="Purple Preset" class="w-10 h-10 rounded-full bg-purple-500 hover:ring-4 ring-purple-200 dark:ring-purple-900 transition-all focus:outline-none"></button>
<button @click="uiColor='#1F2937'" aria-label="Dark Grey Preset" class="w-10 h-10 rounded-full bg-gray-800 hover:ring-4 ring-gray-300 dark:ring-gray-600 transition-all focus:outline-none"></button>
<button @click="uiColor='#FF9500'" aria-label="Orange Preset (Default)" class="w-10 h-10 rounded-full bg-[#FF9500] ring-4 ring-orange-200 dark:ring-orange-900 transition-all focus:outline-none relative">
<span class="material-icons text-white text-sm absolute inset-0 flex items-center justify-center">check</span>
</button>
</div>
</div>
</div>
</section>
<section>
<div class="flex items-center gap-3 mb-4">
<span class="material-icons text-primary text-3xl">font_download</span>
<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Insert custom font</h2>
</div>
<div class="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
<div>
<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="font-name">Font Family Name</label>
<input v-model="fontName" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-primary shadow-sm" id="font-name" placeholder="e.g. Roboto, Open Sans" type="text"/>
</div>
</div>
</div>
</section>
</div>
<div class="bg-gray-50 dark:bg-gray-800 px-8 py-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4">
<router-link to="/" class="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Cancel
            </router-link>
<button @click="saveSettings" class="px-8 py-3 rounded-lg bg-primary text-white font-bold text-lg shadow-lg hover:bg-orange-600 hover:shadow-xl transition-all flex items-center gap-2">
<span class="material-icons">save</span>
                Save All Settings
            </button>
</div>
</main>
</body>
</template>
