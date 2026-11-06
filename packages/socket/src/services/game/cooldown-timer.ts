import { EVENTS } from "@razzia/common/constants"
import type { Server } from "@razzia/common/types/game/socket"
import { gameSpeed } from "@razzia/socket/env"

export class CooldownTimer {
  private readonly io: Server
  private readonly gameId: string
  private timeout: ReturnType<typeof setTimeout> | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private complete: (() => void) | null = null
  private deadline = 0
  constructor(io: Server, gameId: string) {
    this.io = io
    this.gameId = gameId
  }

  start(seconds: number, announce = true): Promise<void> {
    this.abort()
    this.deadline = Date.now() + seconds * 1000 * gameSpeed

    return new Promise((resolve) => {
      this.complete = resolve
      this.timeout = setTimeout(
        () => this.abort(),
        Math.max(1, seconds * 1000 * gameSpeed),
      )

      if (announce) {
        this.interval = setInterval(
          () =>
            this.io
              .to(this.gameId)
              .emit(EVENTS.GAME.COOLDOWN, this.remaining()),
          Math.max(1, 1000 * gameSpeed),
        )
      }
    })
  }
  remaining(): number {
    return Math.max(
      0,
      Math.ceil((this.deadline - Date.now()) / (1000 * gameSpeed)),
    )
  }
  abort(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    if (this.interval) {
      clearInterval(this.interval)
    }

    this.timeout = null
    this.interval = null
    this.deadline = 0
    const { complete } = this
    this.complete = null
    complete?.()
  }
}
