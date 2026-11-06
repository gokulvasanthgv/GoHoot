import { AlertDialog as RadixAlertDialog } from "radix-ui"
import Button from "@razzia/web/components/Button"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

const AlertDialog = ({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: Props) => {
  const { t } = useTranslation()

  return (
    <RadixAlertDialog.Root>
      <RadixAlertDialog.Trigger asChild>{trigger}</RadixAlertDialog.Trigger>

      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="data-[state=open]:animate-fade-in fixed inset-0 z-50 bg-black/40" />

        <RadixAlertDialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
          <RadixAlertDialog.Title className="text-lg font-semibold text-gray-900">
            {title}
          </RadixAlertDialog.Title>

          <RadixAlertDialog.Description className="mt-2 [overflow-wrap:anywhere] text-gray-500">
            {description}
          </RadixAlertDialog.Description>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <RadixAlertDialog.Cancel asChild>
              <Button className="min-h-11 bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">
                {t("common:cancel")}
              </Button>
            </RadixAlertDialog.Cancel>

            <RadixAlertDialog.Action asChild>
              <Button
                className="min-h-11 bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 active:brightness-90"
                onClick={onConfirm}
              >
                {confirmLabel ?? t("common:confirm")}
              </Button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  )
}

export default AlertDialog
