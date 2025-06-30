-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL,
    "playerWhiteId" TEXT,
    "playerBlackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "moveNum" INTEGER NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "san" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerWhiteId_fkey" FOREIGN KEY ("playerWhiteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerBlackId_fkey" FOREIGN KEY ("playerBlackId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
