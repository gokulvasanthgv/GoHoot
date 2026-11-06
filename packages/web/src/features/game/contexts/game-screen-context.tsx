import { createContext, useContext } from "react"

export const GameScreenContext = createContext<"manager" | "player">("player")

export const useIsManagerScreen = () =>
  useContext(GameScreenContext) === "manager"
