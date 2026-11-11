import { Dialog } from "radix-ui"
import { EVENTS } from "@razzia/common/constants"
import type { Player } from "@razzia/common/types/game"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import ConductorMusic from "@razzia/web/features/game/components/ConductorMusic"
import { Maximize2, X } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: ManagerStatusDataMap["SHOW_ROOM"]
}

const Room = ({ data: { text, inviteCode } }: Props) => {
  const { gameId, players } = useManagerStore()
  const { socket } = useSocket()
  const webUrl = window.location.origin
  const [playerList, setPlayerList] = useState<Player[]>(players)
  const [totalPlayers, setTotalPlayers] = useState(
    players.filter((player) => player.connected).length,
  )
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.NEW_PLAYER, (player) => {
    setPlayerList((current) => [
      ...current.filter((entry) => entry.clientId !== player.clientId),
      player,
    ])
  })

  useEvent(EVENTS.MANAGER.REMOVE_PLAYER, (playerId) => {
    setPlayerList((current) => current.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.MANAGER.PLAYER_KICKED, (playerId) => {
    setPlayerList((current) => current.filter((p) => p.id !== playerId))
  })

  useEvent(EVENTS.GAME.TOTAL_PLAYERS, (total) => {
    setTotalPlayers(total)
  })

  const handleKick = (playerId: string) => () => {
    if (!gameId) {
      return
    }

    socket.emit(EVENTS.MANAGER.KICK_PLAYER, {
      gameId,
      playerId,
    })
  }

  return (
    <section className="conductor-compact:shrink-0 conductor-compact:basis-auto conductor-compact:py-3 relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-2">
      <ConductorMusic />
      <div className="conductor-compact:mb-4 conductor-compact:w-full conductor-compact:max-w-lg conductor-compact:flex-row conductor-compact:items-center conductor-compact:gap-2 mb-10 flex flex-col-reverse items-center gap-3 md:flex-row md:items-stretch">
        <div className="conductor-compact:min-w-0 conductor-compact:flex-1 conductor-compact:flex-col conductor-compact:items-start conductor-compact:px-3 conductor-compact:py-2.5 flex flex-col items-center justify-center rounded-xl bg-white px-6 py-4 md:flex-row">
          <div className="min-w-0">
            <p className="conductor-compact:text-sm text-2xl font-bold">
              {t("game:joinInstruction")}
            </p>
            <p className="conductor-compact:text-sm max-w-64 text-lg font-extrabold break-all">
              {webUrl}
            </p>
          </div>

          <div className="conductor-compact:mx-0 conductor-compact:my-1.5 conductor-compact:h-px conductor-compact:w-full my-4 h-0.5 w-full bg-gray-300 md:mx-4 md:h-full md:w-0.5" />

          <div className="min-w-0">
            <p className="conductor-compact:text-sm text-2xl font-bold">
              {t("game:gamePinLabel")}
            </p>
            <p className="conductor-compact:text-[clamp(1.75rem,7vw,3rem)] text-6xl font-extrabold tabular-nums">
              {inviteCode}
            </p>
          </div>
        </div>

        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={t("game:expandQrCode", "Enlarge join QR code")}
              className="group conductor-compact:size-[clamp(5rem,24vw,7rem)] relative flex size-40 shrink-0 rounded-xl bg-white p-2"
            >
              <QRCodeSVG
                className="size-full"
                value={`${webUrl}?pin=${inviteCode}`}
                aria-hidden="true"
              />
              <span className="conductor-compact:inset-auto conductor-compact:right-1 conductor-compact:bottom-1 conductor-compact:opacity-100 absolute inset-0 flex items-center justify-center rounded-xl opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="conductor-compact:p-1 rounded-md bg-black/85 p-2">
                  <Maximize2
                    className="conductor-compact:size-3.5 size-6 text-white"
                    aria-hidden="true"
                  />
                </span>
              </span>
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 overflow-y-auto rounded-2xl bg-white p-3 sm:p-4"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  {t("game:joinQrCode", "Join by QR code")}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label={t("game:closeQrCode", "Close join QR code")}
                    className="grid size-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <QRCodeSVG
                className="size-[min(23rem,calc(100dvw-3rem),calc(100dvh-7rem))] shrink-0"
                value={`${webUrl}?pin=${inviteCode}`}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <h2 className="conductor-compact:mb-2 conductor-compact:text-2xl mb-4 text-center text-4xl font-bold text-white drop-shadow-lg">
        {t(text)}
      </h2>

      <div className="conductor-compact:mb-3 conductor-compact:px-3 conductor-compact:py-1.5 mb-6 flex items-center justify-center rounded-lg bg-black/65 px-6 py-3">
        <span className="conductor-compact:text-base text-2xl font-bold text-white drop-shadow-md">
          {t("game:playersJoined")}
          {totalPlayers}
        </span>
      </div>

      <div className="conductor-compact:gap-2 flex max-w-full flex-wrap justify-center gap-3">
        {playerList.map((player) => (
          <button
            type="button"
            key={player.id}
            className="bg-primary conductor-compact:min-h-11 conductor-compact:px-3 conductor-compact:py-1.5 conductor-compact:text-base max-w-full rounded-xl px-4 py-3 text-3xl font-bold [overflow-wrap:anywhere] text-white drop-shadow-sm hover:line-through hover:decoration-3"
            onClick={handleKick(player.id)}
          >
            {player.username}
          </button>
        ))}
      </div>
    </section>
  )
}

export default Room
