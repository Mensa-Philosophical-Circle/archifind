import { Bot, Send, Sparkles, User } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import type { NodeData } from '../types';

type GraphMode = 'architecture' | 'file';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    text: string;
};

interface Props {
    graphMode: GraphMode;
    selectedNode: NodeData | null;
}

export default function ArchitectureChat({ graphMode, selectedNode }: Props) {
    const [isOpen, setIsOpen] = useState(true);
    const [question, setQuestion] = useState('What is the most important part of this architecture?');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            text: 'Ask about modules, dependencies, layers, or where a feature lives.',
        },
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedSummary = useMemo(() => {
        if (!selectedNode) {
            return 'No node selected.';
        }

        return `${selectedNode.data.label} • ${selectedNode.data.role || 'unknown'} • ${selectedNode.data.layer}`;
    }, [selectedNode]);

    if (!isOpen) {
        return (
            <button type="button" className="assistant-fab" onClick={() => setIsOpen(true)} aria-label="Open architecture assistant">
                <Bot size={18} />
                <span>Ask AI</span>
            </button>
        );
    }

    const sendQuestion = async (event?: FormEvent) => {
        event?.preventDefault();

        const trimmedQuestion = question.trim();
        if (!trimmedQuestion || loading) {
            return;
        }

        const nextUserMessage: Message = {
            id: Date.now(),
            role: 'user',
            text: trimmedQuestion,
        };

        setMessages(current => [...current, nextUserMessage]);
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: trimmedQuestion,
                    graphMode,
                    selectedNodeId: selectedNode?.id ?? null,
                }),
            });

            if (!response.ok) {
                throw new Error(`Assistant request failed (${response.status})`);
            }

            const data = await response.json();
            setMessages(current => [...current, {
                id: Date.now() + 1,
                role: 'assistant',
                text: data.answer || 'No answer returned.',
            }]);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : 'Assistant request failed';
            setError(message);
            setMessages(current => [...current, {
                id: Date.now() + 1,
                role: 'assistant',
                text: 'I could not reach the assistant right now. Try again in a moment.',
            }]);
        } finally {
            setLoading(false);
            setQuestion('');
        }
    };

    return (
        <section className="assistant-card assistant-floating">
            <div className="assistant-header">
                <div>
                    <div className="assistant-kicker">
                        <Sparkles size={12} />
                        AI Assistant
                    </div>
                    <div className="assistant-title">Ask about the architecture</div>
                </div>
                <button type="button" className="assistant-close" onClick={() => setIsOpen(false)} aria-label="Minimize assistant">
                    <Bot size={16} />
                </button>
            </div>

            <div className="assistant-context">
                <span>Mode: {graphMode}</span>
                <span>Selected: {selectedSummary}</span>
            </div>

            <div className="assistant-messages">
                {messages.map(message => (
                    <div key={message.id} className={`assistant-message ${message.role}`}>
                        <div className="assistant-message-icon">
                            {message.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                        </div>
                        <div className="assistant-message-text">{message.text}</div>
                    </div>
                ))}
            </div>

            <form className="assistant-form" onSubmit={sendQuestion}>
                <textarea
                    className="assistant-input"
                    value={question}
                    onChange={event => setQuestion(event.target.value)}
                    rows={3}
                    placeholder="Ask something like: what talks to the auth module?"
                />
                <button className="assistant-send" type="submit" disabled={loading}>
                    <Send size={14} />
                    {loading ? 'Asking...' : 'Ask'}
                </button>
            </form>

            {error && <div className="assistant-error">{error}</div>}
        </section>
    );
}
