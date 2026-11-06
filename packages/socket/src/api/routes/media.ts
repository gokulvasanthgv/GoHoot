import { MAX_MEDIA_SIZE } from "@razzia/common/constants"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import {
  deleteMedia,
  listMedia,
  uploadMedia,
} from "@razzia/socket/services/upload"
import { consumeLimit } from "@razzia/socket/services/rate-limit"

export const media = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      media: listMedia(c.get("user")),
    }),
  )
  .post("/", async (c) => {
    const ownerId = c.get("user").id

    if (!consumeLimit(`uploads:${ownerId}`, 20, 60_000)) {
      return c.json({ error: "errors:auth.rateLimited" }, 429)
    }

    const form = await c.req.parseBody()
    const { file } = form

    if (!(file instanceof File) || file.size > MAX_MEDIA_SIZE) {
      return c.json({ error: "errors:media.tooLarge" }, 413)
    }

    const result = await uploadMedia(
      file.name,
      file.type,
      Buffer.from(await file.arrayBuffer()),
      ownerId,
    )

    if (!result.success) {
      return c.json({ error: result.error }, 415)
    }

    return c.json(result, 201)
  })
  .delete("/:name", (c) => {
    deleteMedia(c.req.param("name"), c.get("user"))

    return c.body(null, 204)
  })
