'use client'

import { create } from 'zustand'
import type { Profile, Business, Location, FeatureFlag } from '@/types'
import { UserRole } from '@/lib/constants'

// ============================================
// Auth Store
// ============================================
interface AuthState {
    user: Profile | null
    business: Business | null
    location: Location | null
    isLoading: boolean
    setUser: (user: Profile | null) => void
    setBusiness: (business: Business | null) => void
    setLocation: (location: Location | null) => void
    setLoading: (loading: boolean) => void
    reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    business: null,
    location: null,
    isLoading: true,
    setUser: (user) => set({ user }),
    setBusiness: (business) => set({ business }),
    setLocation: (location) => set({ location }),
    setLoading: (isLoading) => set({ isLoading }),
    reset: () => set({ user: null, business: null, location: null, isLoading: false }),
}))

// ============================================
// Feature Flags Store
// ============================================
interface FeatureFlagsState {
    flags: FeatureFlag[]
    setFlags: (flags: FeatureFlag[]) => void
    isEnabled: (flagKey: string) => boolean
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
    flags: [],
    setFlags: (flags) => set({ flags }),
    isEnabled: (flagKey: string) => {
        const flag = get().flags.find((f) => f.flag_key === flagKey)
        return flag?.is_enabled ?? false
    },
}))

// ============================================
// UI Store (sidebar, modals, etc.)
// ============================================
interface UIState {
    sidebarOpen: boolean
    toggleSidebar: () => void
    setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
