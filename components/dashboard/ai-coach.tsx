"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Bot, SendHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function AiCoach() {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status } = useChat()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const isBusy = status !== "ready"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const text = inputValue.trim()
    if (!text || isBusy) {
      return
    }

    sendMessage({ text })
    setInputValue("")
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
          aria-label="Open AI Coach"
        >
          <Bot className="size-6" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="bg-card text-foreground h-[500px] w-[350px] gap-0 overflow-hidden p-0 shadow-2xl">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="text-muted-foreground size-5" />
              <p className="font-semibold">AI Coach</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Coach"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="bg-background flex-1 space-y-3 overflow-y-auto p-4">
          {messages
            .filter((message) => message.role !== "system")
            .map((message) => {
              const text = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")

              if (!text) {
                return null
              }

              const isUser = message.role === "user"

              return (
                <div
                  key={message.id}
                  className={cn("max-w-[80%] px-3 py-2", {
                    "ml-auto rounded-2xl rounded-br-sm bg-indigo-600 text-white":
                      isUser,
                    "rounded-2xl rounded-bl-sm bg-muted": !isUser,
                  })}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
                </div>
              )
            })}

          {(status === "submitted" || status === "streaming") && (
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="bg-muted-foreground/70 size-1.5 rounded-full animate-bounce" />
                <span
                  className="bg-muted-foreground/70 size-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="bg-muted-foreground/70 size-1.5 rounded-full animate-bounce"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t px-3 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              disabled={isBusy}
              placeholder="Ask something..."
              className="bg-muted/50 focus:ring-indigo-500 flex-1 rounded-full border-0 px-4 py-2 text-sm focus:outline-none focus:ring-2"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isBusy || !inputValue.trim()}
              className="h-9 w-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
              aria-label="Send message"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
