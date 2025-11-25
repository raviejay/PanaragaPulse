<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-400 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🌊</div>
        <h1 class="text-3xl font-bold text-gray-800">Panaraga Pulse</h1>
        <p class="text-gray-500 mt-2">Protect our ocean's treasures</p>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
        {{ success }}
      </div>

      <!-- Login Form -->
      <form v-if="!showRegister" @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <input
            v-model="name"
            type="text"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <!-- Toggle Between Login/Register -->
      <div class="mt-6 text-center">
  <button
    @click="toggleForm"
    class="text-cyan-600 hover:text-cyan-700 font-medium"
  >
    <template v-if="showRegister">
      Already have an account?
      <span class="underline">Login</span>
    </template>

    <template v-else>
      Don't have an account?
      <span class="underline">Register</span>
    </template>
  </button>
</div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { supabase } from '@/js/supabase';
import { useRouter } from 'vue-router';

const router = useRouter();
const email = ref('');
const password = ref('');
const name = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');
const showRegister = ref(false);

const toggleForm = () => {
  showRegister.value = !showRegister.value;
  error.value = '';
  success.value = '';
  email.value = '';
  password.value = '';
  name.value = '';
};

const handleLogin = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';
    
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (loginError) throw loginError;

    success.value = 'Login successful! Redirecting...';
    
    // Router will handle redirect via auth state change in App.vue
    
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  try {
    loading.value = true;
    error.value = '';
    success.value = '';
    
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          name: name.value,
        }
      }
    });

    if (signUpError) throw signUpError;

    success.value = 'Account created successfully! Please check your email to verify.';
    
    // Reset form
    setTimeout(() => {
      email.value = '';
      password.value = '';
      name.value = '';
      showRegister.value = false;
    }, 2000);
    
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>