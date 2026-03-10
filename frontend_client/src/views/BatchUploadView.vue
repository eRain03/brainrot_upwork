<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { brainrotDictionary, msRates } from '../utils/eldoradoDict';

const router = useRouter();

// State
const apiKey = ref('');
const showKeyModal = ref(false);
const isDark = ref(false);

// Eldorado specific state
const authMode = ref<'email' | 'cookie'>('email');
const eldoCookie = ref('');
const eldoEmail = ref('');
const eldoPassword = ref('');

const availableCategories = computed(() => Object.keys(brainrotDictionary));

interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'ready' | 'uploading' | 'success' | 'error';
  error: string | null;
  listing: {
    title: string;
    clean_name: string;
    mutation: string;
    traits_count: number;
    brainrot_type: string;
    price: number;
    check_title: string;
  };
  selectedCategory: string;
  selectedItem: string;
  selectedMsRate: string;
}

const batchItems = ref<BatchItem[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
  fileInput.value?.click();
};

onMounted(() => {
  const savedKey = localStorage.getItem('eldo_api_key');
  if (savedKey) apiKey.value = savedKey;

  const savedAuthMode = localStorage.getItem('eldo_auth_mode');
  if (savedAuthMode) authMode.value = savedAuthMode as 'email' | 'cookie';
  
  const savedCookie = localStorage.getItem('eldo_cookie');
  if (savedCookie) eldoCookie.value = savedCookie;
  
  const savedEmail = localStorage.getItem('eldo_email');
  if (savedEmail) eldoEmail.value = savedEmail;
  
  const savedPassword = localStorage.getItem('eldo_password');
  if (savedPassword) eldoPassword.value = savedPassword;
});

const saveEldoCredentials = () => {
  localStorage.setItem('eldo_auth_mode', authMode.value);
  localStorage.setItem('eldo_cookie', eldoCookie.value);
  localStorage.setItem('eldo_email', eldoEmail.value);
  localStorage.setItem('eldo_password', eldoPassword.value);
};

watch(authMode, saveEldoCredentials);
watch(eldoCookie, saveEldoCredentials);
watch(eldoEmail, saveEldoCredentials);
watch(eldoPassword, saveEldoCredentials);

const handleFiles = (files: FileList | null) => {
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (file && file.type.startsWith('image/')) {
      const id = Math.random().toString(36).substring(2, 11);
      batchItems.value.push({
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        error: null,
        listing: {
          title: '',
          clean_name: '',
          mutation: '',
          traits_count: 0,
          brainrot_type: 'Non-free',
          price: 0,
          check_title: ''
        },
        selectedCategory: 'Brainrot God',
        selectedItem: 'Other',
        selectedMsRate: '0'
      });
    }
  }
  processQueue();
};

const handleFileInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  handleFiles(input.files);
  input.value = ''; // Reset input
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  handleFiles(event.dataTransfer?.files || null);
};

const removeBatchItem = (index: number) => {
  const item = batchItems.value[index];
  if (item && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
  batchItems.value.splice(index, 1);
};

// Queue processor
const MAX_CONCURRENT = 3;
let activeTasks = 0;

const processQueue = async () => {
  while (activeTasks < MAX_CONCURRENT) {
    const itemToProcess = batchItems.value.find(item => item.status === 'pending');
    if (!itemToProcess) break;

    activeTasks++;
    itemToProcess.status = 'analyzing';
    analyzeItem(itemToProcess).finally(() => {
      activeTasks--;
      processQueue();
    });
  }
};

const analyzeItem = async (item: BatchItem) => {
  if (!apiKey.value) {
    item.status = 'error';
    item.error = "API Key not set";
    return;
  }

  const formData = new FormData();
  formData.append('file', item.file);

  try {
    const response = await fetch('http://localhost:6671/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.value}`
      },
      body: formData
    });

    if (!response.ok) {
        if (response.status === 403) {
             item.error = "Invalid API Key";
        } else {
             const errData = await response.json();
             item.error = errData.detail || "Analysis failed.";
        }
        item.status = 'error';
        return;
    }

    const data = await response.json();
    
    item.listing.title = data.title || '';
    item.listing.clean_name = data.clean_name || '';
    item.listing.mutation = data.mutation || '';
    item.listing.traits_count = data.traits_count || 0;
    item.listing.brainrot_type = data.brainrot_type || 'Non-free';
    item.listing.price = data.price_suggestion || 0;
    item.listing.check_title = item.listing.title;

    if (data.item_name) {
        let found = false;
        const target = data.item_name.toLowerCase().trim();
        for (const cat in brainrotDictionary) {
            for (const itemName in brainrotDictionary[cat]) {
                if (itemName.toLowerCase() === target) {
                    item.selectedCategory = cat;
                    item.selectedItem = itemName;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    if (data.ms_rate) {
        const rateStr = data.ms_rate.toUpperCase().trim();
        if (rateStr.includes('B/S')) {
            const num = parseFloat(rateStr.replace('B/S', '').trim());
            if (!isNaN(num) && num >= 1) {
                item.selectedMsRate = "1+ B/s";
            }
        } else if (rateStr.includes('M/S')) {
            const num = parseInt(rateStr.replace('M/S', '').replace(/,/g, '').trim(), 10);
            if (!isNaN(num)) {
                if (num <= 24) item.selectedMsRate = "0-24 M/s";
                else if (num <= 49) item.selectedMsRate = "25-49 M/s";
                else if (num <= 99) item.selectedMsRate = "50-99 M/s";
                else if (num <= 249) item.selectedMsRate = "100-249 M/s";
                else if (num <= 499) item.selectedMsRate = "250-499 M/s";
                else if (num <= 749) item.selectedMsRate = "500-749 M/s";
                else if (num <= 999) item.selectedMsRate = "750-999 M/s";
            }
        }
    }

    item.status = 'ready';
  } catch (err: any) {
    console.error(err);
    item.status = 'error';
    item.error = err.message;
  }
};

const getAvailableItems = (category: string) => {
  return Object.keys(brainrotDictionary[category] || {});
};

const handleCategoryChange = (item: BatchItem) => {
    const items = getAvailableItems(item.selectedCategory);
    if (!items.includes(item.selectedItem)) {
        item.selectedItem = items.length > 0 ? (items[0] as string) : '';
    }
};

const submitItem = async (item: BatchItem) => {
    if (authMode.value === 'email' && (!eldoEmail.value || !eldoPassword.value)) {
        alert("Please enter Eldorado Email and Password.");
        return;
    }
    if (authMode.value === 'cookie' && !eldoCookie.value) {
        alert("Please enter Eldorado Cookie.");
        return;
    }
    if (!item.listing.price || item.listing.price <= 0) {
        alert("Please set a valid price.");
        return;
    }

    item.status = 'uploading';
    item.error = null;

    const emojiMap: Record<string, string> = {
        'Rainbow': '🌈', 'Lava': '🔥', 'Golden': '✨',
    };
    let emojis = "";
    if (item.listing.mutation && emojiMap[item.listing.mutation]) {
        emojis += emojiMap[item.listing.mutation];
    }
    const descriptionTemplate = `High-value ${item.listing.mutation || ''} ${item.listing.title} with ${item.listing.traits_count} traits! ${emojis}

Price: $${item.listing.price}
Type: ${item.listing.brainrot_type}

DM for more info! #Roblox #Brainrot`;
    
    const tradeEnvId = brainrotDictionary[item.selectedCategory]?.[item.selectedItem] || '';

    const formData = new FormData();
    formData.append('authMode', authMode.value);
    if (authMode.value === 'email') {
        formData.append('email', eldoEmail.value);
        formData.append('password', eldoPassword.value);
    } else {
        formData.append('cookieStr', eldoCookie.value);
    }
    formData.append('title', item.listing.title || 'Untitled');
    formData.append('description', descriptionTemplate);
    formData.append('price', item.listing.price.toString());
    formData.append('tradeEnvironmentId', tradeEnvId);
    formData.append('msRate', item.selectedMsRate);
    formData.append('mutations', item.listing.mutation || '');
    formData.append('image', item.file);

    try {
        const response = await fetch('http://localhost:6675/api/create-offer', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            item.status = 'success';
        } else {
            throw new Error(data.message || 'Failed to create listing');
        }
    } catch (err: any) {
        console.error(err);
        item.status = 'error';
        item.error = err.message;
    }
};

const publishAllReady = async () => {
    const readyItems = batchItems.value.filter(i => i.status === 'ready');
    for (const item of readyItems) {
        await submitItem(item);
    }
};

</script>

<template>
  <div :class="[isDark ? 'dark bg-[#111]' : 'bg-[#f5f5f5]', 'min-h-screen font-sans text-black dark:text-white flex flex-col transition-colors duration-300']">
    
    <header class="flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto">
      <div class="flex items-center gap-2">
        <h1 class="text-4xl font-extrabold text-black dark:text-white tracking-tight">Eldo Batch Upload</h1>
      </div>
      <div class="flex items-center gap-4">
        <button class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors" @click="isDark = !isDark">
          <span class="material-icons-round text-black dark:text-white">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
        </button>
        <button @click="router.push('/')" class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors" title="Single Upload">
          <span class="material-icons-round text-3xl text-black dark:text-white">dashboard</span>
        </button>
        <button @click="router.push('/listings')" class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors" title="My Listings">
          <span class="material-icons-round text-3xl text-black dark:text-white">inventory_2</span>
        </button>
        <button @click="router.push('/settings')" class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors" title="Settings">
          <span class="material-icons-round text-3xl text-black dark:text-white">settings</span>
        </button>
      </div>
    </header>

    <main class="flex-1 w-full max-w-7xl mx-auto px-6 pb-6 flex flex-col gap-6">
      
      <!-- Account Credentials & Actions Top Bar -->
      <div class="bg-white dark:bg-white/5 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex gap-2">
            <label class="text-sm font-bold flex items-center gap-1 cursor-pointer">
              <input type="radio" v-model="authMode" value="email" class="accent-primary" /> Email
            </label>
            <label class="text-sm font-bold flex items-center gap-1 cursor-pointer">
              <input type="radio" v-model="authMode" value="cookie" class="accent-primary" /> Cookie
            </label>
          </div>
          
          <div v-if="authMode === 'email'" class="flex gap-2">
            <input v-model="eldoEmail" class="bg-black/5 dark:bg-white/10 border-none rounded-lg px-3 py-2 text-sm" placeholder="Email" type="text" />
            <input v-model="eldoPassword" class="bg-black/5 dark:bg-white/10 border-none rounded-lg px-3 py-2 text-sm" placeholder="Password" type="password" />
          </div>
          <div v-else>
            <input v-model="eldoCookie" class="bg-black/5 dark:bg-white/10 border-none rounded-lg px-3 py-2 text-sm w-64" placeholder="Cookie string" type="password" />
          </div>
        </div>

        <div>
           <button @click="publishAllReady" :disabled="!batchItems.some(i => i.status === 'ready')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              <span class="material-icons-round">publish</span> Publish All Ready
           </button>
        </div>
      </div>

      <!-- Drag and Drop Zone -->
      <div 
        class="border-4 border-dashed border-black/20 dark:border-white/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-black/40 dark:hover:border-white/40 transition-colors"
        @dragover.prevent
        @drop="handleDrop"
        @click="triggerFileInput"
      >
        <span class="material-icons-round text-6xl text-gray-400 mb-4">cloud_upload</span>
        <h2 class="text-xl font-bold mb-2">Drag & Drop Images Here</h2>
        <p class="text-black/60 dark:text-white/60">or click to browse multiple files</p>
        <input type="file" ref="fileInput" multiple accept="image/*" class="hidden" @change="handleFileInputChange" />
      </div>

      <!-- Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div v-for="(item, index) in batchItems" :key="item.id" class="bg-white dark:bg-[#1a1a1a] rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative border border-black/5 dark:border-white/5 group">
            
            <button @click="removeBatchItem(index)" class="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500">
                <span class="material-icons-round text-sm">close</span>
            </button>

            <!-- Image preview -->
            <div class="relative aspect-square rounded-xl overflow-hidden bg-black/10">
                <img :src="item.previewUrl" class="w-full h-full object-cover" />
                
                <!-- Status Overlay -->
                <div v-if="item.status !== 'ready' && item.status !== 'success'" class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <span v-if="item.status === 'pending'" class="material-icons-round text-3xl animate-pulse">schedule</span>
                    <span v-if="item.status === 'analyzing'" class="material-icons-round text-3xl animate-spin">refresh</span>
                    <span v-if="item.status === 'uploading'" class="material-icons-round text-3xl animate-spin">cloud_upload</span>
                    <span v-if="item.status === 'error'" class="material-icons-round text-3xl text-red-400">error</span>
                    <p class="text-xs font-bold mt-2 uppercase tracking-wider">{{ item.status }}</p>
                    <p v-if="item.error" class="text-xs text-red-300 mt-1 px-2 text-center break-words max-w-full">{{ item.error }}</p>
                </div>
                 <div v-if="item.status === 'success'" class="absolute inset-0 bg-green-500/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <span class="material-icons-round text-5xl">check_circle</span>
                    <p class="font-bold mt-2">Published</p>
                </div>
            </div>

            <!-- Content Details -->
            <div class="flex flex-col gap-2 flex-1">
                <div>
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Title</label>
                    <input v-model="item.listing.title" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-sm font-bold" placeholder="Title" />
                </div>
                
                <div class="flex gap-2">
                    <div class="w-1/3">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Price ($)</label>
                        <input v-model="item.listing.price" type="number" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-sm font-bold text-green-600 dark:text-green-400" placeholder="Price" />
                    </div>
                    <div class="w-1/3">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Mutation</label>
                        <input v-model="item.listing.mutation" type="text" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-sm" placeholder="None" />
                    </div>
                    <div class="w-1/3">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Traits</label>
                        <input v-model="item.listing.traits_count" type="number" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-sm" placeholder="0" />
                    </div>
                </div>

                <div class="flex gap-2">
                    <div class="w-1/2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Category</label>
                        <select v-model="item.selectedCategory" @change="handleCategoryChange(item)" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-xs truncate">
                            <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
                        </select>
                    </div>
                    <div class="w-1/2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Item</label>
                        <select v-model="item.selectedItem" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-xs truncate">
                            <option v-for="opt in getAvailableItems(item.selectedCategory)" :key="opt" :value="opt">{{ opt }}</option>
                        </select>
                    </div>
                </div>

                <div class="flex gap-2">
                    <div class="w-1/2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">M/s Rate</label>
                        <select v-model="item.selectedMsRate" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-xs truncate">
                            <option v-for="(val, label) in msRates" :key="label" :value="val">{{ label }}</option>
                        </select>
                    </div>
                    <div class="w-1/2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Type</label>
                        <select v-model="item.listing.brainrot_type" class="w-full bg-black/5 dark:bg-white/10 border-none rounded-lg px-2 py-1.5 text-xs">
                            <option value="Non-free">Non-free</option>
                            <option value="Free">Free</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Action Button -->
            <button @click="submitItem(item)" :disabled="item.status !== 'ready' && item.status !== 'error'" class="mt-2 w-full py-2 rounded-lg font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :class="item.status === 'success' ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'">
                <span v-if="item.status !== 'success'" class="material-icons-round text-lg">publish</span>
                {{ item.status === 'success' ? 'Done' : (item.status === 'uploading' ? 'Publishing...' : 'Publish') }}
            </button>

        </div>
      </div>

    </main>
  </div>
</template>

<style scoped>
/* custom scrollbar styles could be included here if needed, omitted for brevity as tailwind handles mostly */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
