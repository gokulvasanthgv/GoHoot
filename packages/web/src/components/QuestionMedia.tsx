import { MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia as QuestionMediaType } from "@razzia/common/types/game"
import clsx from "clsx"

interface Props {
  media?: QuestionMediaType
  alt?: string
  className?: string
}

export const getYoutubeId = (url: string): string | null => {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  if (match && match[2].length === 11) {
    return match[2]
  }
  const shortsRegExp = /youtube\.com\/shorts\/([^#\&\?]*)/
  const shortsMatch = url.match(shortsRegExp)
  if (shortsMatch && shortsMatch[1].length === 11) {
    return shortsMatch[1]
  }
  return null
}

const QuestionMedia = ({ media, alt = "", className }: Props) => {
  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        alt={alt}
        src={media.url}
        className={clsx("w-auto rounded-md object-contain", className || "max-h-36 sm:max-h-60 md:max-h-100")}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.VIDEO) {
    const youtubeId = getYoutubeId(media.url)
    if (youtubeId) {
      return (
        <iframe
          className={clsx("m-2 aspect-video w-full max-w-xl rounded-md px-4", className || "h-36 sm:h-60 md:h-100")}
          src={`https://www.youtube.com/embed/${youtubeId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={alt}
        />
      )
    }

    return (
      <video
        className={clsx("m-2 aspect-video w-auto rounded-md px-4 object-contain", className || "max-h-36 sm:max-h-60 md:max-h-100")}
        src={media.url}
        autoPlay
        controls
      />
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    return (
      <audio
        className={clsx("m-4 mb-2 w-auto rounded-md", className)}
        src={media.url}
        autoPlay
        controls
      />
    )
  }

  return null
}

export default QuestionMedia

