import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! How can I help you today?',
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Function to detect if content contains markdown
  const hasMarkdown = (text: string): boolean => {
    const markdownPatterns = [
      /\*\*.*?\*\*/,     // Bold **text**
      /\*.*?\*/,         // Italic *text*
      /__.*?__/,         // Bold __text__
      /_.*?_/,           // Italic _text_
      /`.*?`/,           // Inline code `code`
      /```[\s\S]*?```/,  // Code blocks ```code```
      /^#{1,6}\s/m,      // Headers # ## ###
      /^\* /m,           // Unordered lists
      /^\d+\. /m,        // Ordered lists
      /\[.*?\]\(.*?\)/,  // Links [text](url)
      /^>/m,             // Blockquotes
    ]
    
    return markdownPatterns.some(pattern => pattern.test(text))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Send message to webhook endpoint
      const response = await fetch('https://primary-production-b68a.up.railway.app/webhook/lumina_chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          timestamp: userMessage.timestamp.toISOString(),
          user_id: 'user_' + Date.now() // Generate a simple user ID
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Create assistant response from API using "output" field
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.output || data.response || data.message || 'I received your message but couldn\'t generate a proper response.',
        role: 'assistant',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I\'m having trouble connecting to the server right now. Please try again later.',
        role: 'assistant',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-white">Chat Assistant</h1>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    message.role === 'user' 
                      ? 'bg-blue-600' 
                      : 'bg-green-600'
                  }`}>
                    {message.role === 'user' ? 'U' : 'AI'}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100 border border-gray-700'
                  }`}>
                    <div className="text-sm leading-relaxed">
                      {message.role === 'assistant' && hasMarkdown(message.content) ? (
                        <div className="markdown-content">
                          <ReactMarkdown 
                            components={{
                              // Style markdown elements for dark theme
                              h1: ({children}) => <h1 className="text-xl font-bold text-white mb-4 mt-3 first:mt-0 leading-tight">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-bold text-white mb-3 mt-3 first:mt-0 leading-tight">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-bold text-white mb-2 mt-3 first:mt-0 leading-tight">{children}</h3>,
                              h4: ({children}) => <h4 className="text-sm font-bold text-white mb-2 mt-2 first:mt-0 leading-tight">{children}</h4>,
                              h5: ({children}) => <h5 className="text-sm font-bold text-white mb-2 mt-2 first:mt-0 leading-tight">{children}</h5>,
                              h6: ({children}) => <h6 className="text-sm font-bold text-white mb-2 mt-2 first:mt-0 leading-tight">{children}</h6>,
                              p: ({children}) => <p className="text-gray-100 mb-4 last:mb-0 leading-relaxed">{children}</p>,
                              code: ({children}) => <code className="bg-gray-700 text-green-400 px-2 py-1 rounded text-xs font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-gray-700 text-green-400 p-4 rounded-md my-4 overflow-x-auto text-sm font-mono border border-gray-600">{children}</pre>,
                              ul: ({children}) => <ul className="list-disc text-gray-100 mb-4 ml-6 space-y-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal text-gray-100 mb-4 ml-6 space-y-3">{children}</ol>,
                              li: ({children}) => <li className="text-gray-100 leading-relaxed">{children}</li>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-600 pl-4 my-4 text-gray-300 italic bg-gray-750 py-3 rounded-r">{children}</blockquote>,
                              a: ({children, href}) => <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                              strong: ({children}) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({children}) => <em className="italic text-gray-200">{children}</em>,
                              hr: () => <hr className="border-gray-600 my-6" />,
                              table: ({children}) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-gray-600">{children}</table></div>,
                              th: ({children}) => <th className="border border-gray-600 px-3 py-2 bg-gray-700 text-white font-semibold text-left">{children}</th>,
                              td: ({children}) => <td className="border border-gray-600 px-3 py-2 text-gray-100">{children}</td>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-gray-100 leading-relaxed">{message.content}</p>
                      )}
                    </div>
                    <div className={`text-xs mt-3 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[80%] gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
                    AI
                  </div>
                  <div className="bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Type your message here..."
              className="w-full resize-none border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ maxHeight: '120px' }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md p-2 transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 11L12 6L17 11M12 18V7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(90 12 12)"
                />
              </svg>
            </button>
          </form>
          <div className="mt-2 text-xs text-gray-400 text-center">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
