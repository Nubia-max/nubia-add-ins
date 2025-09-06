-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_chatId_createdAt_idx" ON "chat_messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "chats_userId_isActive_idx" ON "chats"("userId", "isActive");

-- CreateIndex
CREATE INDEX "chats_userId_createdAt_idx" ON "chats"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
