import { create } from "zustand"

export interface User {
  id: string
  username: string
  role: "admin" | "quizmaster" | "analyst" | "quizzer"
}

interface UserStore {
  user: User | null
  setUser: (user: User | null) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
