<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { brainrotDictionary, msRates } from '../utils/eldoradoDict';

const router = useRouter();

// State
const apiKey = ref('');
const showKeyModal = ref(false);
const isDark = ref(false);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const marketLoading = ref(false);

// Eldorado specific state
const eldoEmail = ref('');
const eldoPassword = ref('');
const selectedCategory = ref('Brainrot God');
const selectedItem = ref('Other');
const selectedMsRate = ref('0');
const isSubmitting = ref(false);

const availableCategories = computed(() => Object.keys(brainrotDictionary));
const availableItems = computed(() => {
  return Object.keys(brainrotDictionary[selectedCategory.value] || {});
});

watch(selectedCategory, () => {
  const items = availableItems.value;
  if (!items.includes(selectedItem.value)) {
    selectedItem.value = items.length > 0 ? items[0] : '';
  }
});

// Manual Search State
const showManualSearchModal = ref(false);
const searchCategory = ref('Brainrot God');
const searchItem = ref('Other');
const searchMsRate = ref('0');
const searchMutation = ref('');

const searchAvailableItems = computed(() => {
  if (!searchCategory.value) return [];
  return Object.keys(brainrotDictionary[searchCategory.value] || {});
});

watch(searchCategory, () => {
  const items = searchAvailableItems.value;
  if (!items.includes(searchItem.value)) {
    searchItem.value = items.length > 0 ? items[0] : '';
  }
});

const openManualSearch = () => {
  // Pre-fill with current listing data if it makes sense
  searchCategory.value = selectedCategory.value;
  searchItem.value = selectedItem.value;
  searchMsRate.value = selectedMsRate.value;
  searchMutation.value = listing.value.mutation;
  showManualSearchModal.value = true;
};

const executeManualSearch = () => {
  showManualSearchModal.value = false;
  fetchMarketPrices(true);
};

const saveEldoCredentials = () => {
  localStorage.setItem('eldo_email', eldoEmail.value);
  localStorage.setItem('eldo_password', eldoPassword.value);
};
watch(eldoEmail, saveEldoCredentials);
watch(eldoPassword, saveEldoCredentials);

interface MarketItem {
  title: string;
  price_raw: string;
  price_val: number;
  seller: string;
}

const marketData = ref<{ items: MarketItem[]; average: number }>({
  items: [],
  average: 0
});

const sortDirection = ref<'asc' | 'desc'>('asc');

// Currency Logic
const targetCurrency = ref('USD');
const currencies = [
  'USD', 'EUR', 'JPY', 'GBP', 'CNY',
  'BRL', // Brazil
  'RUB', // Russia
  'PHP', // Philippines
  'TRY', // Turkey
  'CAD', // Canada (Germany/France use EUR)
  'MXN', // Mexico
  'IDR', // Indonesia
  'THB', // Thailand
  'VND', // Vietnam
  'ARS', // Argentina
  'COP'  // Colombia
];

// Static rates relative to USD (Base: USD = 1) - Approx rates as of late 2024/early 2025
const exchangeRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  JPY: 150.0,
  GBP: 0.79,
  CNY: 7.20,
  BRL: 5.75,
  RUB: 98.0,
  PHP: 58.5,
  TRY: 35.0,
  CAD: 1.40,
  MXN: 20.5,
  IDR: 15800,
  THB: 34.5,
  VND: 25300,
  ARS: 1200, 
  COP: 4400
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  CNY: '¥',
  BRL: 'R$',
  RUB: '₽',
  PHP: '₱',
  TRY: '₺',
  CAD: 'C$',
  MXN: 'Mex$',
  IDR: 'Rp',
  THB: '฿',
  VND: '₫',
  ARS: '$',
  COP: '$'
};

const detectCurrency = (priceStr: string): string => {
  if (priceStr.includes('€')) return 'EUR';
  if (priceStr.includes('£')) return 'GBP';
  if (priceStr.includes('R$')) return 'BRL';
  if (priceStr.includes('₽')) return 'RUB';
  if (priceStr.includes('₱')) return 'PHP';
  if (priceStr.includes('₺')) return 'TRY';
  if (priceStr.includes('฿')) return 'THB';
  if (priceStr.includes('₫')) return 'VND';
  if (priceStr.includes('Rp')) return 'IDR';
  // JPY/CNY share symbol often
  if (priceStr.includes('¥') || priceStr.includes('CNY') || priceStr.includes('RMB')) {
     return 'JPY'; 
  }
  return 'USD'; // Default to USD
};

const convertPrice = (amount: number, fromCurr: string, toCurr: string): number => {
  if (fromCurr === toCurr) return amount;
  // Convert to USD first (amount / rate_from), then to target ( * rate_to)
  // Formula: AmountInUSD = amount / rate[from]
  //          TargetAmount = AmountInUSD * rate[to]
  const amountInUSD = amount / exchangeRates[fromCurr];
  return amountInUSD * exchangeRates[toCurr];
};

const sortedMarketItems = computed(() => {
  const items = [...marketData.value.items];
  const sorted = items.sort((a, b) => {
    return sortDirection.value === 'asc' 
      ? a.price_val - b.price_val 
      : b.price_val - a.price_val;
  });

  return sorted.map(item => {
    const originalCurr = detectCurrency(item.price_raw);
    const convertedVal = convertPrice(item.price_val, originalCurr, targetCurrency.value);
    
    // Format display
    const symbol = currencySymbols[targetCurrency.value] || '$';
    const displayPrice = `${symbol}${convertedVal.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
    
    return {
      ...item,
      displayPrice,
      isConverted: originalCurr !== targetCurrency.value
    };
  });
});

const toggleSort = () => {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
};

// Listing Data
const listing = ref({
  title: '',
  clean_name: '',
  mutation: '',
  traits_count: 0,
  brainrot_type: 'Non-free', // Free or Non-free
  price: 0,
  description: '',
  check_title: '' // Manual edit area
});

// Generated Result
const generatedListing = ref('');

// Computed
const isFree = computed({
  get: () => listing.value.brainrot_type === 'Free',
  set: (val) => {
    listing.value.brainrot_type = val ? 'Free' : 'Non-free';
    
    const suffix = " | Steal A Brainrot | COMES WITH FREE BRAINROT 🆓";
    
    if (val) {
      // Add suffix if not already present
      if (!listing.value.check_title.includes(suffix)) {
        listing.value.check_title += suffix;
      }
      // Also update the main title state if synced (optional, but good for consistency)
      if (!listing.value.title.includes(suffix)) {
        listing.value.title += suffix;
      }
    } else {
      // Remove suffix
      listing.value.check_title = listing.value.check_title.replace(suffix, "");
      listing.value.title = listing.value.title.replace(suffix, "");
    }
  }
});

// Lifecycle
onMounted(async () => {
  const storedKey = localStorage.getItem('eldo_api_key');
  if (storedKey) {
    apiKey.value = storedKey;
    // Verify it's still valid and fetch profile
    try {
        const resp = await fetch('http://localhost:6671/me', {
            headers: { 'Authorization': `Bearer ${storedKey}` }
        });
        if (resp.ok) {
             const data = await resp.json();
             if (data.eldorado_email) {
                 eldoEmail.value = data.eldorado_email;
                 localStorage.setItem('eldo_email', data.eldorado_email);
             }
        } else {
             showKeyModal.value = true;
             localStorage.removeItem('eldo_api_key');
             apiKey.value = '';
        }
    } catch(e) {
        // network issue, keep stored for now
    }
  } else {
    showKeyModal.value = true;
  }
  
  const savedPass = localStorage.getItem('eldo_password');
  if (savedPass) eldoPassword.value = savedPass;

  // Check system dark mode preference or stored
  if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

watch(isDark, (val) => {
  if (val) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
});

// Methods
const saveKey = async () => {
  if (apiKey.value.trim()) {
    try {
      const response = await fetch('http://localhost:6671/me', {
        headers: {
          'Authorization': `Bearer ${apiKey.value.trim()}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('eldo_api_key', apiKey.value.trim());
        
        if (data.eldorado_email) {
            // Already bound, auto-fill and proceed
            eldoEmail.value = data.eldorado_email;
            localStorage.setItem('eldo_email', data.eldorado_email);
            showKeyModal.value = false;
        } else {
            // Not bound, prompt user in the same modal
            if (eldoEmail.value) {
                 // User provided email, bind it
                 const bindResp = await fetch('http://localhost:6671/bind-email', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey.value.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ eldorado_email: eldoEmail.value })
                 });
                 if (bindResp.ok) {
                     localStorage.setItem('eldo_email', eldoEmail.value);
                     showKeyModal.value = false;
                 } else {
                     alert("Failed to bind email.");
                 }
            } else {
                alert("Please enter the Eldorado email you wish to bind to this key. This cannot be changed later without admin help.");
            }
        }
      } else {
        alert("Invalid API Key");
      }
    } catch (e) {
        alert("Error verifying API Key");
    }
  }
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    selectedFile.value = input.files[0];
    previewUrl.value = URL.createObjectURL(input.files[0]);
    analyzeImage();
  }
};

const analyzeImage = async () => {
  if (!selectedFile.value || !apiKey.value) return;

  loading.value = true;
  error.value = null;

  const formData = new FormData();
  formData.append('file', selectedFile.value);

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
             error.value = "Invalid or expired API Key.";
             showKeyModal.value = true;
        } else {
             const errData = await response.json();
             error.value = errData.detail || "Analysis failed.";
        }
        throw new Error(error.value || "Analysis failed");
    }

    const data = await response.json();
    
    // Map AI response to state
    listing.value.title = data.title || '';
    listing.value.clean_name = data.clean_name || ''; // Store clean name for search
    listing.value.mutation = data.mutation || '';
    listing.value.traits_count = data.traits_count || 0;
    listing.value.brainrot_type = data.brainrot_type || 'Non-free';
    listing.value.price = data.price_suggestion || 0;
    
    // Auto-fill check title
    listing.value.check_title = listing.value.title;

    // --- Auto-select Category and Item based on LLM's item_name ---
    if (data.item_name) {
        let found = false;
        const target = data.item_name.toLowerCase().trim();
        for (const cat in brainrotDictionary) {
            for (const item in brainrotDictionary[cat]) {
                if (item.toLowerCase() === target) {
                    selectedCategory.value = cat;
                    // Trigger watch or set directly
                    setTimeout(() => { selectedItem.value = item; }, 50);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    // --- Auto-select M/s Rate based on LLM's ms_rate ---
    if (data.ms_rate) {
        const rateStr = data.ms_rate.toUpperCase().trim();
        if (rateStr.includes('B/S')) {
            // "1.2B/s", "4.4B/s", etc.
            const num = parseFloat(rateStr.replace('B/S', '').trim());
            if (!isNaN(num) && num >= 1) {
                selectedMsRate.value = "1+ B/s";
            }
        } else if (rateStr.includes('M/S')) {
            const num = parseInt(rateStr.replace('M/S', '').replace(/,/g, '').trim(), 10);
            if (!isNaN(num)) {
                if (num <= 24) selectedMsRate.value = "0-24 M/s";
                else if (num <= 49) selectedMsRate.value = "25-49 M/s";
                else if (num <= 99) selectedMsRate.value = "50-99 M/s";
                else if (num <= 249) selectedMsRate.value = "100-249 M/s";
                else if (num <= 499) selectedMsRate.value = "250-499 M/s";
                else if (num <= 749) selectedMsRate.value = "500-749 M/s";
                else if (num <= 999) selectedMsRate.value = "750-999 M/s";
            }
        }
    }

    // Fetch market prices using selected filters
    fetchMarketPrices();

  } catch (err: any) {
    console.error(err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchMarketPrices = async (isManual = false) => {
    marketLoading.value = true;
    marketData.value = { items: [], average: 0 };
    
    try {
        const params = new URLSearchParams();
        
        let cat = isManual ? searchCategory.value : selectedCategory.value;
        let item = isManual ? searchItem.value : selectedItem.value;
        let mut = isManual ? searchMutation.value : listing.value.mutation;
        let ms = isManual ? searchMsRate.value : selectedMsRate.value;

        // Map selectedMsRate back to the dictionary value if possible
        // e.g. "1+ B/s" -> "1-plus-bs"
        let mappedMs = '';
        if (ms === "1+ B/s") mappedMs = "1-plus-bs";
        else if (ms && ms !== "0") {
            mappedMs = ms.toLowerCase().replace(/ \//g, '-').replace(/\//g, '-').replace(/ /g, '-');
        }
        if (mappedMs) params.append('ms_rate', mappedMs);
        
        if (mut) params.append('mutations', mut.toLowerCase());
        
        if (cat) params.append('category', cat);
        if (item && item !== 'Other') params.append('item_name', item);

        const response = await fetch(`http://localhost:6671/market?${params.toString()}`, {
             headers: {
                'Authorization': `Bearer ${apiKey.value}`
             }
        });
        if (response.ok) {
            const data = await response.json();
            marketData.value = data;
        }
    } catch (e) {
        console.error("Error fetching market data", e);
    } finally {
        marketLoading.value = false;
    }
};

const submitToEldorado = async () => {
    if (!eldoEmail.value || !eldoPassword.value) {
        alert("Please enter Eldorado Email and Password in the left panel.");
        return;
    }
    if (!selectedFile.value) {
        alert("Please upload an image first.");
        return;
    }
    if (!listing.value.price || listing.value.price <= 0) {
        alert("Please set a valid price.");
        return;
    }

    isSubmitting.value = true;
    error.value = null;

    // Generate description for payload
    const emojiMap: Record<string, string> = {
        'Rainbow': '🌈', 'Lava': '🔥', 'Golden': '✨',
    };
    let emojis = "";
    if (listing.value.mutation && emojiMap[listing.value.mutation]) {
        emojis += emojiMap[listing.value.mutation];
    }
    const descriptionTemplate = `High-value ${listing.value.mutation || ''} ${listing.value.title} with ${listing.value.traits_count} traits! ${emojis}\n\nPrice: $${listing.value.price}\nType: ${listing.value.brainrot_type}\n\nDM for more info! #Roblox #Brainrot`;
    generatedListing.value = descriptionTemplate;

    const tradeEnvId = brainrotDictionary[selectedCategory.value][selectedItem.value];

    const formData = new FormData();
    formData.append('email', eldoEmail.value);
    formData.append('password', eldoPassword.value);
    formData.append('title', listing.value.title || 'Untitled');
    formData.append('description', descriptionTemplate);
    formData.append('price', listing.value.price.toString());
    formData.append('tradeEnvironmentId', tradeEnvId);
    formData.append('msRate', selectedMsRate.value);
    formData.append('mutations', listing.value.mutation || '');
    formData.append('image', selectedFile.value);

    try {
        const response = await fetch('http://localhost:6675/api/create-offer', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`Success! Listing created.\nID: ${data.id}\nURL: ${data.url}`);
        } else {
            throw new Error(data.message || 'Failed to create listing');
        }
    } catch (err: any) {
        console.error(err);
        error.value = err.message;
        alert("Error creating listing: " + err.message);
    } finally {
        isSubmitting.value = false;
    }
};

const exportCSV = () => {
    const headers = ["Title", "Description", "Price", "Type", "Mutation", "Traits"];
    const row = [
        listing.value.title,
        generatedListing.value.replace(/\n/g, " "), // Flatten description
        listing.value.price,
        listing.value.brainrot_type,
        listing.value.mutation,
        listing.value.traits_count
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + row.join(",");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "listing.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

</script>

<template>
  <!-- API Key Modal -->
  <div v-if="showKeyModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="bg-white dark:bg-zinc-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
      <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Enter API Key</h2>
      <p class="mb-6 text-gray-600 dark:text-gray-400">Please enter your license key to access the tool.</p>
      <input v-model="apiKey" type="text" placeholder="sk-..." class="w-full mb-4 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" />
      
      <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">If this is a new key, bind your Eldorado Email:</p>
      <input v-model="eldoEmail" type="email" placeholder="Eldorado Email (Optional if already bound)" class="w-full mb-6 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary" />

      <button @click="saveKey" class="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors">
        Access Dashboard
      </button>
    </div>
  </div>

  <!-- Manual Search Modal -->
  <div v-if="showManualSearchModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="bg-white dark:bg-zinc-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Manual Search</h2>
        <button @click="showManualSearchModal = false" class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors">
          <span class="material-icons-round">close</span>
        </button>
      </div>
      <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">Set filters to check market prices independently.</p>
      
      <div class="space-y-4 mb-6">
        <div>
          <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Category & Item</label>
          <div class="flex gap-2">
            <select v-model="searchCategory" class="w-1/2 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm">
              <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <select v-model="searchItem" class="w-1/2 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm">
              <option v-for="item in searchAvailableItems" :key="item" :value="item">{{ item }}</option>
            </select>
          </div>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">M/s Rate</label>
          <select v-model="searchMsRate" class="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm">
            <option v-for="rate in msRates" :key="rate" :value="rate">{{ rate }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Mutation (Optional)</label>
          <input v-model="searchMutation" type="text" placeholder="e.g. Lava, Rainbow" class="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-primary focus:border-primary text-sm" />
        </div>
      </div>

      <button @click="executeManualSearch" class="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
        <span class="material-icons-round">search</span>
        Search Market
      </button>
    </div>
  </div>

  <header class="flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto">
    <div class="flex items-center gap-2">
      <h1 class="text-4xl font-extrabold text-black dark:text-white tracking-tight">Eldo Ai</h1>
    </div>
    <div class="flex items-center gap-4">
      <button class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors" @click="isDark = !isDark">
        <span class="material-icons-round text-black dark:text-white">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
      </button>
      <button @click="router.push('/settings')" class="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors">
        <span class="material-icons-round text-3xl text-black dark:text-white">settings</span>
      </button>
    </div>
  </header>

  <main class="flex-1 w-full max-w-7xl mx-auto px-6 pb-6 grid grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-100px)] lg:overflow-hidden">
    
    <!-- Left Column: Image & Inputs -->
    <section class="col-span-12 lg:col-span-3 flex flex-col gap-4 lg:h-full lg:overflow-y-auto pr-2 custom-scrollbar">
      <div class="relative group aspect-[3/4] rounded-2xl bg-black/10 dark:bg-white/5 border-4 border-dashed border-black/20 dark:border-white/20 flex items-center justify-center overflow-hidden transition-all hover:border-black/40 dark:hover:border-white/40 cursor-pointer shrink-0">
        <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" @change="handleFileChange" />
        <img v-if="previewUrl" :src="previewUrl" alt="Upload preview" class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300" />
        <div v-else class="text-center p-4">
             <span class="material-icons-round text-4xl text-gray-400">add_a_photo</span>
             <p class="text-sm font-bold text-gray-500 mt-2">Upload Screenshot</p>
        </div>
        <div v-if="previewUrl" class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4 pointer-events-none">
          <div class="bg-white/20 backdrop-blur-md rounded-lg p-2 text-center">
            <span class="text-white font-bold text-sm">Change Image</span>
          </div>
        </div>
      </div>
      
      <div class="flex flex-col gap-3 shrink-0">
        <div class="group">
          <label class="block text-sm font-bold text-black/70 dark:text-white/70 mb-1 ml-1">Title Override</label>
          <input v-model="listing.title" class="w-full bg-black/20 dark:bg-white/10 border-none rounded-xl px-4 py-3 placeholder-black/40 dark:placeholder-white/40 text-black dark:text-white focus:ring-2 focus:ring-white/50 dark:focus:ring-white/30 transition-all font-medium" placeholder="Insert title (if missing)" type="text"/>
        </div>
        <div class="group">
          <label class="block text-sm font-bold text-black/70 dark:text-white/70 mb-1 ml-1">Mutation</label>
          <input v-model="listing.mutation" class="w-full bg-black/20 dark:bg-white/10 border-none rounded-xl px-4 py-3 placeholder-black/40 dark:placeholder-white/40 text-black dark:text-white focus:ring-2 focus:ring-white/50 dark:focus:ring-white/30 transition-all font-medium" placeholder="Insert mutation (if missing)" type="text"/>
        </div>
        <div class="group">
          <label class="block text-sm font-bold text-black/70 dark:text-white/70 mb-1 ml-1">Traits</label>
          <input v-model="listing.traits_count" class="w-full bg-black/20 dark:bg-white/10 border-none rounded-xl px-4 py-3 placeholder-black/40 dark:placeholder-white/40 text-black dark:text-white focus:ring-2 focus:ring-white/50 dark:focus:ring-white/30 transition-all font-medium" placeholder="Insert trait amounts" type="number"/>
        </div>
      </div>

      <!-- Eldorado Account Section -->
      <div class="bg-black/5 dark:bg-white/5 p-4 rounded-2xl flex flex-col gap-3 shrink-0 border border-black/10 dark:border-white/10">
        <h3 class="text-sm font-bold text-black/80 dark:text-white/80 border-b border-black/10 dark:border-white/10 pb-2">Eldorado Account</h3>
        <input v-model="eldoEmail" type="email" placeholder="Email" class="w-full bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary" disabled title="Contact admin to change bound email"/>
        <input v-model="eldoPassword" type="password" placeholder="Password" class="w-full bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary" />
        <p class="text-[10px] text-gray-500 italic mt-[-8px]">We do not save your login information and password. You must re-enter your password upon page refresh.</p>
        
        <label class="block text-xs font-bold text-black/70 dark:text-white/70 mt-1">Category & Item</label>
        <select v-model="selectedCategory" class="w-full bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary">
          <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="selectedItem" class="w-full bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary">
          <option v-for="item in availableItems" :key="item" :value="item">{{ item }}</option>
        </select>

        <label class="block text-xs font-bold text-black/70 dark:text-white/70 mt-1">M/s Rate</label>
        <select v-model="selectedMsRate" class="w-full bg-white dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary">
          <option v-for="rate in msRates" :key="rate" :value="rate">{{ rate }}</option>
        </select>
      </div>

    </section>

    <!-- Center Column: Editor -->
    <section class="col-span-12 lg:col-span-5 flex flex-col h-full lg:overflow-y-auto custom-scrollbar">
      <div class="bg-background-light dark:bg-background-dark rounded-3xl p-6 shadow-2xl flex flex-col gap-6 relative overflow-hidden border border-white/20 dark:border-white/5 h-full">
        
        <!-- Loading Overlay -->
        <div v-if="loading" class="absolute inset-0 z-20 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center">
             <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <div class="flex flex-col gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <span class="bg-primary/20 text-primary-dark dark:text-primary px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">AI Detected</span>
            <h2 class="text-sm font-bold text-gray-500 dark:text-gray-400">Choose Title</h2>
          </div>
          <div class="p-4 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[5rem] flex items-center">
            <h3 class="text-2xl font-black leading-tight text-gray-900 dark:text-white">
              {{ listing.title || 'Waiting for image...' }} <br/>
              <span v-if="listing.mutation || listing.traits_count" class="text-primary font-bold text-lg">({{ listing.mutation ? listing.mutation + ',' : '' }} {{ listing.traits_count }} Traits)</span>
            </h3>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 shrink-0">
          <label class="cursor-pointer relative">
            <input type="radio" class="peer sr-only" name="brainrot_type" :value="true" v-model="isFree"/>
            <div class="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark peer-checked:border-primary peer-checked:bg-primary/5 dark:peer-checked:bg-primary/10 transition-all hover:bg-gray-50 dark:hover:bg-gray-800">
              <div class="flex flex-col items-center justify-center gap-2 text-center h-full">
                <span class="material-icons-round text-3xl text-gray-400 peer-checked:text-primary">check_circle</span>
                <span class="font-bold text-lg text-gray-900 dark:text-white">Free<br/>Brainrot</span>
              </div>
            </div>
          </label>
          <label class="cursor-pointer relative">
            <input type="radio" class="peer sr-only" name="brainrot_type" :value="false" v-model="isFree"/>
            <div class="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark peer-checked:border-primary peer-checked:bg-primary/5 dark:peer-checked:bg-primary/10 transition-all hover:bg-gray-50 dark:hover:bg-gray-800">
              <div class="flex flex-col items-center justify-center gap-2 text-center h-full">
                <span class="material-icons-round text-3xl text-gray-400 peer-checked:text-primary">cancel</span>
                <span class="font-bold text-lg text-gray-900 dark:text-white">No Free<br/>Brainrot</span>
              </div>
            </div>
          </label>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-700 my-2 shrink-0"></div>

        <div class="flex-1 flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-gray-500 dark:text-gray-400">Check title here</label>
            <textarea v-model="listing.check_title" class="w-full h-24 bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary resize-none font-medium text-lg" placeholder="Edit here if mistakes found in AI analysis..."></textarea>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-bold text-gray-500 dark:text-gray-400">Set Your Price</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span>
              <input v-model="listing.price" class="w-full bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-4 text-3xl font-bold text-gray-900 dark:text-white focus:ring-primary focus:border-primary placeholder-gray-300 dark:placeholder-gray-600" placeholder="0.00" type="number"/>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Right Column: Prices & Actions -->
    <section class="col-span-12 lg:col-span-4 flex flex-col gap-6 lg:h-full lg:overflow-hidden">
      <div class="flex-1 bg-surface-dark dark:bg-black/40 rounded-3xl p-6 text-white flex flex-col shadow-xl backdrop-blur-sm border border-white/10 min-h-0">
        <div class="flex items-center justify-between mb-6 shrink-0">
          <div class="flex items-center gap-3">
             <h3 class="text-xl font-bold">List of Prices</h3>
             <div class="relative">
                <select v-model="targetCurrency" class="bg-black/20 text-white text-xs font-bold py-1 pl-2 pr-6 rounded-lg border-none focus:ring-1 focus:ring-white/30 cursor-pointer appearance-none">
                    <option v-for="curr in currencies" :key="curr" :value="curr" class="text-black bg-white">{{ curr }}</option>
                </select>
                <span class="material-icons-round absolute right-1 top-1/2 -translate-y-1/2 text-sm pointer-events-none">expand_more</span>
             </div>
          </div>
          <div class="flex items-center gap-2">
             <button @click="openManualSearch" class="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-xs font-bold transition-colors" title="Manual Search">
                <span class="material-icons-round text-sm">manage_search</span>
                Manual
             </button>
             <button @click="fetchMarketPrices(false)" class="flex items-center gap-1 bg-primary/20 hover:bg-primary/40 text-primary-light px-2 py-1 rounded text-xs font-bold transition-colors" title="Refresh Current Item">
                <span class="material-icons-round text-sm" :class="{'animate-spin': marketLoading}">refresh</span>
                Refresh
             </button>
             <button @click="toggleSort" class="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-xs font-medium transition-colors" title="Toggle Sort Order">
                <span class="material-icons-round text-sm">{{ sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                {{ sortDirection === 'asc' ? 'Lowest' : 'Highest' }}
             </button>
             <span class="bg-white/10 px-2 py-1 rounded text-xs font-mono text-white/70">LIVE</span>
          </div>
        </div>
        
        <div class="flex-1 min-h-0 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[500px] lg:h-auto">
           
           <div v-if="marketLoading" class="flex flex-col items-center justify-center py-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                <span class="text-gray-400 text-sm">Searching market...</span>
           </div>

           <div v-else-if="marketData.items.length === 0" class="text-center text-gray-400 py-10">
               No listings found for this item.
           </div>

           <div v-for="(item, index) in sortedMarketItems" :key="index" class="flex items-center justify-between bg-white/5 hover:bg-white/10 p-4 rounded-xl transition-colors cursor-pointer group border border-white/5 hover:border-white/20">
            <div>
              <div class="text-xl font-bold text-green-400">
                {{ item.displayPrice }}
                <span v-if="item.isConverted" class="text-xs text-gray-500 line-through ml-1">{{ item.price_raw }}</span>
              </div>
              <div class="text-xs text-gray-400 flex items-center gap-1 mt-1 line-clamp-1">
                <span class="material-icons-round text-xs">store</span>
                {{ item.seller }}
              </div>
            </div>
            <div class="text-right w-1/3">
                 <div class="text-[10px] text-gray-500 leading-tight line-clamp-2">{{ item.title }}</div>
            </div>
          </div>

        </div>
        
        <div class="mt-4 pt-4 border-t border-white/10 shrink-0">
          <div class="text-center text-xs text-gray-400">Market Average: <span class="text-white font-bold">{{ marketData.average > 0 ? '$' + marketData.average.toLocaleString() : '---' }}</span></div>
        </div>
      </div>

      <button @click="submitToEldorado" :disabled="isSubmitting" class="w-full bg-white text-primary dark:bg-white dark:text-primary-dark font-black text-2xl py-6 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
        {{ isSubmitting ? 'Listing...' : 'List Brainrot' }}
        <span v-if="!isSubmitting" class="material-icons-round text-3xl">rocket_launch</span>
        <div v-else class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </button>
       <button @click="exportCSV" class="w-full bg-black/10 dark:bg-white/10 text-black dark:text-white font-bold text-lg py-4 rounded-2xl hover:bg-black/20 dark:hover:bg-white/20 transition-all shrink-0">
        Export CSV
      </button>
    </section>
  </main>
</template>