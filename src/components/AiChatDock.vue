<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useFiltersStore } from '../stores/filtersStore';
import { useBondDataStore } from '../stores/bondDataStore';

const props = defineProps<{
  currentPath: string;
}>();

const filtersStore = useFiltersStore();
const dataStore = useBondDataStore();

const isOpen = ref(false);
const messages = ref<{ id: number; role: 'user' | 'assistant'; content: string }[]>([]);
const input = ref('');
const isStreaming = ref(false);
const messagesEndRef = ref<HTMLDivElement | null>(null);
const chatDockRef = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesEndRef.value) {
      messagesEndRef.value.scrollIntoView({ behavior: 'smooth' });
    }
  });
};

watch(isOpen, (newVal) => {
  if (newVal) {
    scrollToBottom();
  }
});

// Click outside to close handler
const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value && chatDockRef.value && !chatDockRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

const sendMessage = async () => {
  if (!input.value.trim() || isStreaming.value) return;

  const userMsg = input.value;
  messages.value.push({ id: Date.now(), role: 'user', content: userMsg });
  input.value = '';
  isStreaming.value = true;
  scrollToBottom();

  // Construct chart & dashboard data context to feed the AI model
  const dataContext: Record<string, any> = {
    activeTab: filtersStore.activeTab,
    selectedCountries: filtersStore.selectedCountries,
  };

  // Attach relevant data arrays depending on the active view
  if (dataStore.countriesData) {
    dataContext.featuredYields = {
      DE: dataStore.countriesData['DE']?.at(-1)?.value,
      FR: dataStore.countriesData['FR']?.at(-1)?.value,
      IT: dataStore.countriesData['IT']?.at(-1)?.value,
      ES: dataStore.countriesData['ES']?.at(-1)?.value,
    };
  }
  if (dataStore.policyRatesData) {
    dataContext.ecbPolicyRates = {
      DFR: dataStore.policyRatesData['DFR']?.at(-1)?.value,
      MRR: dataStore.policyRatesData['MRR_FR']?.at(-1)?.value,
    };
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMsg,
        dataContext,
        history: messages.value.slice(0, -1)
      })
    });

    if (!response.ok) {
      throw new Error('AI Server connection failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMsg = '';
    const assistantId = Date.now() + 1;
    
    messages.value.push({ id: assistantId, role: 'assistant', content: '' });

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.response) {
                assistantMsg += parsed.response;
                const idx = messages.value.findIndex(m => m.id === assistantId);
                if (idx !== -1) {
                  messages.value[idx].content = assistantMsg;
                  scrollToBottom();
                }
              }
            } catch (e) {
              // Ignore partial lines
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error talking to AI agent:', error);
    messages.value.push({
      id: Date.now() + 2,
      role: 'assistant',
      content: 'Sorry, I encountered an issue connecting to the macroeconomic intelligence server. Please try again.'
    });
    scrollToBottom();
  } finally {
    isStreaming.value = false;
  }
};
</script>

<template>
  <!-- Render ONLY on interactive app pages, NOT on the landing page -->
  <div 
    v-if="currentPath === '/app' || currentPath === '/compare'" 
    class="fixed bottom-6 right-6 z-50 font-mono"
    ref="chatDockRef"
  >
    <!-- Toggle Button -->
    <button 
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-4 py-2.5 shadow-lg select-none cursor-pointer border transition-all duration-200 active:scale-95 bg-[#003399] border-[#003399] text-white hover:bg-[#002280]"
    >
      <span class="text-sm">{{ isOpen ? '✕' : '💬' }}</span>
      <span class="text-[10px] font-bold tracking-wider uppercase">{{ isOpen ? 'CLOSE' : 'ASK AI ANALYST' }}</span>
    </button>

    <!-- Chat Overlay Window (Increased dimensions and high contrast theme) -->
    <div 
      v-if="isOpen"
      class="absolute bottom-14 right-0 w-[360px] sm:w-[420px] h-[520px] flex flex-col shadow-2xl transition-all duration-300 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
    >
      <!-- Chat Header (Solid Brand Blue) -->
      <div class="bg-[#003399] text-white p-3.5 border-b border-[#003399]/10 flex items-center justify-between font-bold">
        <span class="text-[10px] font-bold tracking-widest uppercase">EUROMETRICS AI ANALYST</span>
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>

      <!-- Messages Window -->
      <div class="flex-grow p-4 overflow-y-auto flex flex-col gap-3">
        <!-- Welcome Message (Clean High-Contrast Gray Card) -->
        <div class="p-3 border text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
          <p class="font-bold uppercase text-[9px] mb-1 opacity-70 text-[#003399] dark:text-blue-400">SYSTEM</p>
          <p>
            Welcome to EuroMetrics AI. I am directly connected to the ECB and Eurostat data pipelines. Ask me questions about:
          </p>
          <ul class="list-disc pl-4 mt-1.5 space-y-1">
            <li>What these macro/yield indicators mean.</li>
            <li>Relevance of Maastricht interest rate criteria.</li>
            <li>Reasons behind inflation spikes or yield spreads.</li>
          </ul>
        </div>

        <!-- Chat Stream -->
        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="p-3 border max-w-[85%] flex flex-col gap-1 text-xs leading-relaxed"
          :class="[
            msg.role === 'user'
              ? 'bg-[#003399] border-[#003399] text-white self-end'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 self-start'
          ]"
        >
          <span 
            class="text-[9px] font-bold uppercase tracking-wider"
            :class="msg.role === 'user' ? 'text-blue-200' : 'text-[#003399] dark:text-blue-400'"
          >
            {{ msg.role === 'user' ? 'USER' : 'ANALYST' }}
          </span>
          <p class="whitespace-pre-wrap">{{ msg.content }}</p>
        </div>

        <!-- Streaming Indicator -->
        <div 
          v-if="isStreaming && !messages.at(-1)?.content"
          class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 self-start max-w-[85%] animate-pulse"
        >
          Analyzing metrics...
        </div>

        <div ref="messagesEndRef"></div>
      </div>

      <!-- Chat Input Form -->
      <form 
        @submit.prevent="sendMessage"
        class="p-2 border-t flex gap-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
      >
        <input 
          v-model="input"
          placeholder="Ask a macro question..."
          class="flex-grow px-3 py-2 text-xs border bg-transparent text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#003399] focus:ring-1 focus:ring-[#003399]"
          :disabled="isStreaming"
        />
        <button 
          type="submit"
          class="px-4 py-2 text-[10px] font-bold tracking-widest uppercase cursor-pointer border transition-all bg-[#003399] border-[#003399] text-white hover:bg-[#002280]"
          :disabled="isStreaming"
        >
          SEND
        </button>
      </form>
    </div>
  </div>
</template>
