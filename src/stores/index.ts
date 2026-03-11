'use client'

import { create } from 'zustand'
import type { Profile, Business, Location, FeatureFlag } from '@/types'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

// ============================================
// Auth Store
// ============================================
interface AuthState {
    user: Profile | null
    business: Business | null
    location: Location | null
    timezone: string
    isLoading: boolean
    selectedBusinessId: string | 'all'
    selectedLocationId: string | 'all'
    setUser: (user: Profile | null) => void
    setBusiness: (business: Business | null) => void
    setLocation: (location: Location | null) => void
    setLoading: (loading: boolean) => void
    setSelectedBusinessId: (id: string | 'all') => void
    setSelectedLocationId: (id: string | 'all') => void
    reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    business: null,
    location: null,
    timezone: DEFAULT_TIMEZONE,
    isLoading: true,
    selectedBusinessId: typeof window !== 'undefined' ? (localStorage.getItem('selectedBusinessId') || 'all') : 'all',
    selectedLocationId: typeof window !== 'undefined' ? (localStorage.getItem('selectedLocationId') || 'all') : 'all',
    setUser: (user) => set({ user }),
    setBusiness: (business) => set({
        business,
        timezone: business?.timezone ?? DEFAULT_TIMEZONE,
    }),
    setLocation: (location) => set({ location }),
    setLoading: (isLoading) => set({ isLoading }),
    setSelectedBusinessId: (selectedBusinessId) => {
        if (typeof window !== 'undefined') {
            if (selectedBusinessId && selectedBusinessId !== 'all') {
                localStorage.setItem('selectedBusinessId', selectedBusinessId)
            } else {
                localStorage.removeItem('selectedBusinessId')
            }
            // Cascading reset
            localStorage.setItem('selectedLocationId', 'all')
        }
        set({ selectedBusinessId, selectedLocationId: 'all' })
    },
    setSelectedLocationId: (selectedLocationId) => {
        if (typeof window !== 'undefined') {
            if (selectedLocationId && selectedLocationId !== 'all') {
                localStorage.setItem('selectedLocationId', selectedLocationId)
            } else {
                localStorage.setItem('selectedLocationId', 'all')
            }
        }
        set({ selectedLocationId })
    },
    reset: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('selectedBusinessId')
            localStorage.removeItem('selectedLocationId')
        }
        set({ user: null, business: null, location: null, timezone: DEFAULT_TIMEZONE, isLoading: false, selectedBusinessId: 'all', selectedLocationId: 'all' })
    },
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
