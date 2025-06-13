import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, onSnapshot, query, deleteDoc, getDoc, where, getDocs, updateDoc } from 'firebase/firestore';
import { ChevronRight, Plus, Hash, BookOpen, MessageSquare, Newspaper, Trash2, User, X, Settings, Bot, Map, UserSquare, Library, Edit, BrainCircuit } from 'lucide-react';

// --- Firebase Configuration ---
// This configuration is provided by the environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper Functions ---
const getUserId = () => auth.currentUser?.uid;

// --- Text Formatter Component ---
const TextFormatter = ({ text }) => {
    if (!text) return null;

    const lines = text.split('\n');

    return (
        <div>
            {lines.map((line, index) => {
                const match = line.match(/^\[([BCIU]+)\]/i);
                if (match) {
                    const commands = match[1].toUpperCase();
                    const style = {};
                    if (commands.includes('B')) style.fontWeight = 'bold';
                    if (commands.includes('C')) style.textAlign = 'center';
                    if (commands.includes('I')) style.fontStyle = 'italic';
                    if (commands.includes('U')) style.textDecoration = 'underline';
                    
                    const formattedLine = line.substring(match[0].length);
                    return <p key={index} style={style}>{formattedLine || '\u00A0'}</p>; // Use non-breaking space for empty lines
                }
                return <p key={index}>{line || '\u00A0'}</p>;
            })}
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState({});
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentView, setCurrentView] = useState('home'); // home, chat, wiki, blogs, profile, map
    const [activeChatroom, setActiveChatroom] = useState(null);
    const [activeWiki, setActiveWiki] = useState(null);
    const [activeBlog, setActiveBlog] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/profile`, 'data');
                const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setUserData(doc.data());
                    }
                    if (!isAuthReady) setIsAuthReady(true);
                }, (error) => {
                    console.error("Error listening to user profile:", error);
                    if (!isAuthReady) setIsAuthReady(true);
                });
                
                if (!isAuthReady) {
                     try {
                         const checkDoc = await getDoc(userDocRef);
                         if (!checkDoc.exists()) {
                             setIsAuthReady(true);
                         }
                     } catch(err) {
                        console.error("Error checking user doc:", err);
                        setIsAuthReady(true);
                     }
                }
                return () => unsubscribeUser();
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Authentication Error:", error);
                }
                if (!isAuthReady) setIsAuthReady(true);
            }
        });
        return () => unsubscribe();
    }, [isAuthReady]);

    const handleNavigation = (view) => {
        setActiveChatroom(null);
        setActiveWiki(null);
        setActiveBlog(null);
        setCurrentView(view);
    };

    const renderView = () => {
        if (!isAuthReady) {
            return <div className="flex items-center justify-center h-full"><div className="text-yellow-400 animate-pulse">Connecting to the HoloNet...</div></div>;
        }

        if (activeChatroom) {
            return <Chatroom room={activeChatroom} goBack={() => setActiveChatroom(null)} userData={userData} />;
        }
        if (activeWiki) {
            return <WikiPage wiki={activeWiki} goBack={() => setActiveWiki(null)} />;
        }
        if (activeBlog) {
            return <BlogPost blog={activeBlog} goBack={() => setActiveBlog(null)} />;
        }

        switch (currentView) {
            case 'chat':
                return <ChatSection onSelectChatroom={setActiveChatroom} />;
            case 'wiki':
                return <WikiSection onSelectWiki={setActiveWiki} />;
            case 'blogs':
                return <BlogSection onSelectBlog={setActiveBlog} />;
            case 'profile':
                return <ProfileSection user={user} userData={userData} />;
            case 'map':
                return <GalaxyMapSection onSelectChatroom={setActiveChatroom} />;
            case 'home':
            default:
                return <HomePage />;
        }
    };

    return (
        <div className="flex h-screen w-screen bg-black text-slate-300 font-sans">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto:wght@300;400;500&display=swap');
              body { font-family: 'Roboto', sans-serif; }
              h1, h2, h3, h4, h5, h6, .font-orbitron { font-family: 'Orbitron', sans-serif; }
              ::-webkit-scrollbar { width: 8px; }
              ::-webkit-scrollbar-track { background: #1e293b; }
              ::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
              ::-webkit-scrollbar-thumb:hover { background: #facc15; }
            `}</style>
            
            <Sidebar 
                handleNavigation={handleNavigation} 
                currentView={currentView}
                user={user}
                userData={userData}
                activeChatroom={activeChatroom}
                activeWiki={activeWiki}
                activeBlog={activeBlog}
            />

            <main className="flex-1 flex flex-col bg-slate-900/50">
                {userData.bannerUrl && (
                     <div className="h-40 bg-cover bg-center" style={{backgroundImage: `url(${userData.bannerUrl})`}}></div>
                )}
                <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    {renderView()}
                </div>
            </main>
        </div>
    );
}

// --- Sidebar/Navigation Component ---
const Sidebar = ({ handleNavigation, currentView, user, userData, activeChatroom, activeWiki, activeBlog }) => {
    const NavItem = ({ icon, text, viewName }) => (
        <button
            onClick={() => handleNavigation(viewName)}
            className={`flex items-center w-full text-left p-3 my-1 rounded-lg transition-all duration-200 ${
                (currentView === viewName && !activeChatroom && !activeWiki && !activeBlog) ? 'bg-yellow-400 text-black shadow-lg' : 'hover:bg-slate-700'
            }`}
        >
            {icon}
            <span className="ml-4 font-semibold">{text}</span>
        </button>
    );

    return (
        <nav className="w-64 bg-slate-800/70 p-4 flex flex-col justify-between border-r border-slate-700">
            <div>
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-yellow-400 font-orbitron">RP HUB</h1>
                    <p className="text-sm text-slate-400">Star Wars Universe</p>
                </header>
                
                <NavItem icon={<Map size={20} />} text="Galaxy Map" viewName="map" />
                <NavItem icon={<MessageSquare size={20} />} text="Chat Channels" viewName="chat" />
                <NavItem icon={<BookOpen size={20} />} text="Holo-Wiki" viewName="wiki" />
                <NavItem icon={<Newspaper size={20} />} text="Data Logs" viewName="blogs" />
                <NavItem icon={<Settings size={20} />} text="Profile" viewName="profile" />
            </div>
            
            {user && (
                 <div className="bg-slate-900 p-3 rounded-lg">
                     <div className="flex items-center mb-2">
                        {userData.photoURL ? (
                            <img src={userData.photoURL} alt="User" className="w-10 h-10 rounded-full mr-3 border-2 border-yellow-400" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/40x40/1e293b/facc15?text=??' }}/>
                        ) : (
                             <User className="text-yellow-400 mr-2" size={24}/>
                        )}
                        <div>
                             <span className="text-sm font-semibold">{userData.displayName || 'Anonymous'}</span>
                             <p className="text-xs text-slate-400 break-words" title={getUserId()}>
                                 ID: {getUserId()?.substring(0,8)}...
                             </p>
                        </div>
                     </div>
                </div>
            )}
        </nav>
    );
};


// --- Home Page Component ---
const HomePage = () => (
    <div className="text-center">
        <h2 className="text-4xl font-orbitron text-yellow-400 mb-4">Welcome to the Outer Rim</h2>
        <p className="text-slate-300 max-w-2xl mx-auto">
            This is your central hub for roleplaying in a galaxy far, far away.
            Navigate using the links on the left to join chat channels, browse the Holo-Wiki, or read data logs.
        </p>
        <div className="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg max-w-lg mx-auto">
            <h3 className="text-2xl font-orbitron text-yellow-400 mb-3">AI NPC Update!</h3>
            <p className="text-left text-sm">
               You can now create persistent NPCs in the Holo-Wiki! Give them a personality and then talk to them by name in any chat channel. Example: <code className="bg-slate-900 p-1 rounded">@NPC_Name, tell me about your day.</code>
            </p>
        </div>
    </div>
);


// --- Generic List Item Display ---
const ItemCard = ({ item, onSelectItem, onEdit, onDelete }) => (
    <div onClick={() => onSelectItem(item)} className="relative text-left bg-slate-800 h-24 rounded-lg border border-slate-700 hover:border-yellow-400 transition-colors group flex flex-col justify-between overflow-hidden cursor-pointer">
       {(item.coverUrl) && <img src={item.coverUrl} className="absolute top-0 left-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity" alt="" onError={(e) => { e.target.style.display = 'none'; }} />}
       <div className="relative w-full h-full flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-100 group-hover:text-yellow-400 truncate">{item.name || "Untitled"}</h3>
            </div>
            <div className="flex-shrink-0 flex justify-between items-end">
                <p className="text-xs text-slate-400">Creator ID: {item.creatorId?.substring(0, 8)}...</p>
                 {item.type && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.type === 'character' ? 'bg-purple-500/20 text-purple-300' :
                        item.type === 'npc' ? 'bg-green-500/20 text-green-300' :
                        'bg-blue-500/20 text-blue-300'
                    }`}>
                        {item.type === 'character' ? <UserSquare size={12} className="mr-1"/> : 
                         item.type === 'npc' ? <BrainCircuit size={12} className="mr-1"/> : 
                         <Library size={12} className="mr-1"/>}
                        {item.type}
                    </span>
                )}
            </div>
       </div>
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="text-slate-300 hover:text-yellow-400"><Edit size={16}/></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
        </div>
    </div>
);


// --- Chat Section ---
const ChatSection = ({ onSelectChatroom }) => {
    const [items, setItems] = useState([]);
    const [modalState, setModalState] = useState({ isOpen: false, item: null });
    const collectionPath = `/artifacts/${appId}/public/data/chatrooms`;

    useEffect(() => {
        const q = query(collection(db, collectionPath));
        const unsub = onSnapshot(q, (snapshot) => setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [collectionPath]);

    const handleSave = async (data) => {
        if (modalState.item) {
            await setDoc(doc(db, collectionPath, modalState.item.id), data, { merge: true });
        } else {
            await addDoc(collection(db, collectionPath), { ...data, creatorId: getUserId(), createdAt: new Date() });
        }
    };

    const handleDelete = async (itemId) => {
        await deleteDoc(doc(db, collectionPath, itemId));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <MessageSquare size={32} className="text-yellow-400" />
                    <h2 className="text-3xl font-orbitron text-yellow-400 ml-3">Chat Channels</h2>
                </div>
                <button onClick={() => setModalState({ isOpen: true, item: null })} className="flex items-center bg-yellow-400 text-black px-4 py-2 rounded-md hover:bg-yellow-300 transition-colors">
                    <Plus size={20} className="mr-2" /> Create Channel
                </button>
            </div>

            {modalState.isOpen && <CreateEditModal onFinish={() => setModalState({ isOpen: false, item: null })} onSave={handleSave} item={modalState.item} fields={[
                { name: 'name', placeholder: 'Channel Name (e.g., Mos Eisley Cantina)'},
                { name: 'coverUrl', placeholder: 'Cover Image URL (Optional)'},
                { name: 'bgUrl', placeholder: 'Background Image URL (Optional)'}
            ]} title="Chat Channel" />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => <ItemCard key={item.id} item={item} onSelectItem={onSelectChatroom} onEdit={(itemToEdit) => setModalState({ isOpen: true, item: itemToEdit })} onDelete={handleDelete} />)}
            </div>
        </div>
    );
};

const Chatroom = ({ room, goBack, userData }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isAiThinking, setIsAiThinking] = useState(false);
    const messagesEndRef = useRef(null);
    
    const messagesCollectionPath = `/artifacts/${appId}/public/data/chatrooms/${room.id}/messages`;
    const wikisCollectionPath = `/artifacts/${appId}/public/data/wikis`;

    useEffect(() => {
        const q = query(collection(db, messagesCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setMessages(fetchedMessages);
        }, (error) => {
             console.error("Error fetching messages:", error);
        });
        return () => unsubscribe();
    }, [messagesCollectionPath]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isAiThinking]);

    const callAiNpc = async (npcName, prompt) => {
        setIsAiThinking(true);
        let npcDoc = null;

        try {
            // Find the NPC in the wiki
            const q = query(collection(db, wikisCollectionPath), where("name", "==", npcName), where("type", "==", "npc"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                await addDoc(collection(db, messagesCollectionPath), { text: `[System] NPC named "${npcName}" not found in Holo-Wiki.`, authorId: 'system', authorName: 'System', createdAt: new Date() });
                setIsAiThinking(false);
                return;
            }
            
            npcDoc = querySnapshot.docs[0];
            const npcData = npcDoc.data();
            const personality = npcData.personality || "a standard Star Wars character";
            const history = npcData.interaction_history || "";

            const fullPrompt = `You are roleplaying as an NPC named ${npcName}.
            Your personality is: ${personality}.
            Here is your memory of past interactions (don't repeat it, just use it for context):
            --- MEMORY START ---
            ${history}
            --- MEMORY END ---
            Based on your personality and memory, respond to the user's latest message. Keep your response in character and concise.
            User's message: "${prompt}"`;

            const payload = { contents: [{ role: "user", parts: [{ text: fullPrompt }] }] };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            
            let aiResponse = "The AI seems to be offline... try again later.";
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                aiResponse = result.candidates[0].content.parts[0].text;
            }

            // Post response to chat
            await addDoc(collection(db, messagesCollectionPath), { text: aiResponse, authorId: `npc-${npcDoc.id}`, authorName: npcName, isNpc: true, createdAt: new Date() });
            
            // Update NPC memory
            const newHistoryEntry = `User: ${prompt}\n${npcName}: ${aiResponse}\n\n`;
            await updateDoc(npcDoc.ref, {
                interaction_history: (history + newHistoryEntry)
            });

        } catch (error) {
            console.error("Error calling/processing NPC response:", error);
            await addDoc(collection(db, messagesCollectionPath), { text: "The AI failed to respond. It might be a network issue.", authorId: 'system', authorName: 'System', createdAt: new Date() });
        } finally {
            setIsAiThinking(false);
        }
    }

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const messageText = newMessage;
        if (messageText.trim() === "") return;
        
        const authorName = userData.displayName || (auth.currentUser?.isAnonymous ? 'Anonymous' : getUserId()?.substring(0,8));
        const photoURL = userData.photoURL || '';
        
        // Check for NPC command e.g. @NPC_Name, message
        const npcMatch = messageText.match(/^@([\w\s-]+),/);

        try {
            if (npcMatch) {
                const npcName = npcMatch[1].trim();
                const prompt = messageText.substring(npcMatch[0].length).trim();
                // Post user's message first
                await addDoc(collection(db, messagesCollectionPath), { text: messageText, authorId: getUserId(), authorName: authorName, authorPhotoURL: photoURL, createdAt: new Date() });
                // Then call the NPC
                callAiNpc(npcName, prompt);
            } else {
                 await addDoc(collection(db, messagesCollectionPath), { text: messageText, authorId: getUserId(), authorName: authorName, authorPhotoURL: photoURL, createdAt: new Date() });
            }
            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-cover bg-center" style={{backgroundImage: room.bgUrl ? `url(${room.bgUrl})` : 'none'}}>
           <div className="flex-1 flex flex-col bg-black/50 p-4 min-h-0">
                <div className="flex-shrink-0 flex items-center mb-4 text-white">
                    <button onClick={goBack} className="mr-4 p-2 rounded-full hover:bg-slate-700/50"><ChevronRight className="rotate-180" size={24} /></button>
                    <Hash className="text-yellow-400" />
                    <h2 className="text-2xl font-orbitron ml-2" style={{textShadow: '1px 1px 3px #000'}}>{room.name}</h2>
                </div>
                <div className="flex-1 bg-slate-900/70 p-4 rounded-lg overflow-y-auto mb-4 border border-slate-700">
                    {messages.map(msg => {
                        const isNpc = msg.isNpc;
                        return (
                            <div key={msg.id} className={`flex items-start mb-4 ${isNpc ? 'ml-4' : ''}`}>
                                {isNpc ? (
                                    <BrainCircuit className="w-8 h-8 rounded-full mr-3 text-green-400 border border-green-400 p-1 flex-shrink-0" />
                                ) : (
                                    <img src={msg.authorPhotoURL} alt={msg.authorName} className="w-8 h-8 rounded-full mr-3 border border-yellow-400 flex-shrink-0" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/32x32/1e293b/facc15?text=??' }} />
                                )}
                                <div>
                                     <p className={`font-bold ${isNpc ? 'text-green-400' : 'text-yellow-400'}`}>{msg.authorName}</p>
                                     <div className="text-slate-200 break-words"><TextFormatter text={msg.text}/></div>
                                </div>
                            </div>
                        )
                    })}
                    {isAiThinking && (
                        <div className="flex items-start mb-4 ml-4">
                            <Bot className="w-8 h-8 rounded-full mr-3 text-cyan-400 border border-cyan-400 p-1 animate-pulse flex-shrink-0" />
                            <div>
                                <p className="font-bold text-cyan-400">AI NPC</p>
                                <p className="text-slate-400 italic animate-pulse">is thinking...</p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex-shrink-0 flex gap-4">
                    <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Send a message, or talk to an NPC with @NpcName, ..." className="flex-grow bg-slate-800 border border-slate-700 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" disabled={isAiThinking} rows="2" />
                    <button type="submit" className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-md hover:bg-yellow-300 transition-colors disabled:bg-slate-500" disabled={isAiThinking}>Send</button>
                </form>
            </div>
        </div>
    );
};


// --- Generic Create/Edit Modal ---
const CreateEditModal = ({ onFinish, onSave, item, fields, title }) => {
    const [state, setState] = useState(() => {
        const initialState = {};
        fields.forEach(field => {
            initialState[field.name] = item?.[field.name] || '';
        });
        return initialState;
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setState(prevState => ({ ...prevState, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const hasName = state.name && state.name.trim() !== '';
        if (!hasName) {
            alert("Name/Title is required.");
            return;
        }
        await onSave(state);
        onFinish();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg w-full max-w-2xl border border-yellow-400 relative">
                <button type="button" onClick={onFinish} className="absolute top-3 right-3 text-slate-400 hover:text-white"><X size={24} /></button>
                <h3 className="text-2xl font-orbitron mb-4 text-yellow-400">{item ? `Edit ${title}` : `Create ${title}`}</h3>
                {fields.map(field => {
                    const C = field.type === 'textarea' ? 'textarea' : 'input';
                    return <div key={field.name}>
                        <label className="block text-yellow-400 mb-1 mt-4 text-sm" htmlFor={field.name}>{field.placeholder}</label>
                        <C id={field.name} type={field.type || 'text'} name={field.name} value={state[field.name]} onChange={handleChange} placeholder={field.placeholder}
                           className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                           rows={field.name === 'personality' ? 5 : (C === 'textarea' ? 10 : undefined)}
                           readOnly={field.readOnly}
                           />
                    </div>
                })}
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onFinish} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-md bg-yellow-400 text-black hover:bg-yellow-300">Save</button>
                </div>
            </form>
        </div>
    );
}

// --- Wiki Section ---
const WikiSection = ({ onSelectWiki }) => {
    const [items, setItems] = useState([]);
    const [modalState, setModalState] = useState({ isOpen: false, item: null, type: null });
    const collectionPath = `/artifacts/${appId}/public/data/wikis`;

    useEffect(() => {
        const q = query(collection(db, collectionPath));
        const unsub = onSnapshot(q, (snapshot) => setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [collectionPath]);
    
    const handleCreate = (type) => {
        setModalState({ isOpen: true, item: null, type: type });
    };

    const handleEdit = (item) => {
        setModalState({isOpen: true, item: item, type: item.type})
    };
    
    const handleSave = async (data) => {
       if (modalState.item) {
           await setDoc(doc(db, collectionPath, modalState.item.id), data, { merge: true });
       } else {
           const initialData = { ...data, type: modalState.type, creatorId: getUserId(), createdAt: new Date() };
           if (modalState.type === 'npc') {
               initialData.interaction_history = "NPC created.";
           }
           await addDoc(collection(db, collectionPath), initialData);
       }
    };

    const handleDelete = async (itemId) => {
        await deleteDoc(doc(db, collectionPath, itemId));
    };
    
    const getFieldsForType = (type) => {
        const baseFields = [
            { name: 'name', placeholder: 'Name / Title'},
            { name: 'coverUrl', placeholder: 'Cover Image URL (Optional)'},
            { name: 'bgUrl', placeholder: 'Background Image URL (Optional)'}
        ];
        if (type === 'npc') {
            return [
                ...baseFields,
                { name: 'personality', placeholder: 'Personality & Backstory', type: 'textarea' },
            ]
        }
        return [...baseFields, { name: 'content', placeholder: 'Content / Biography', type: 'textarea' }];
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <BookOpen size={32} className="text-yellow-400" />
                    <h2 className="text-3xl font-orbitron text-yellow-400 ml-3">Holo-Wiki</h2>
                </div>
                 <div className="flex gap-2">
                    <button onClick={() => handleCreate('npc')} className="flex items-center bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-400 transition-colors">
                        <BrainCircuit size={20} className="mr-2" /> Generate NPC
                    </button>
                    <button onClick={() => handleCreate('character')} className="flex items-center bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-400 transition-colors">
                        <UserSquare size={20} className="mr-2" /> New Character
                    </button>
                    <button onClick={() => handleCreate('wiki')} className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-400 transition-colors">
                        <Library size={20} className="mr-2" /> New Wiki
                    </button>
                </div>
            </div>
            
            {modalState.isOpen && <CreateEditModal 
                onFinish={() => setModalState({ isOpen: false, item: null, type: null })} 
                onSave={handleSave} 
                item={modalState.item}
                fields={getFieldsForType(modalState.type)}
                title={modalState.type === 'character' ? 'Character' : modalState.type === 'npc' ? 'NPC' : 'Wiki Entry'}
            />}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => <ItemCard key={item.id} item={item} onSelectItem={onSelectWiki} onEdit={handleEdit} onDelete={handleDelete} />)}
            </div>
        </div>
    );
};

const WikiPage = ({ wiki, goBack }) => (
    <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        {wiki.coverUrl && <img src={wiki.coverUrl} alt="Cover Image" className="w-full h-48 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
        <div className="p-0 sm:p-6 bg-cover bg-center" style={{backgroundImage: wiki.bgUrl ? `url(${wiki.bgUrl})` : 'none'}}>
            <div className="bg-slate-900/80 p-4 sm:p-6 rounded-lg">
                <div className="flex items-center mb-4">
                    <button onClick={goBack} className="mr-4 p-2 rounded-full hover:bg-slate-700"><ChevronRight className="rotate-180" size={24} /></button>
                    <h2 className="text-3xl font-orbitron text-yellow-400">{wiki.name}</h2>
                </div>
                <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-yellow-400 max-w-none">
                    {wiki.type === 'npc' ? (
                        <>
                            <h3 className="text-yellow-400">Personality & Backstory</h3>
                            <TextFormatter text={wiki.personality} />
                            <h3 className="text-yellow-400 mt-6">Interaction History</h3>
                            <div className="bg-slate-800/50 p-4 rounded-md max-h-60 overflow-y-auto">
                                <TextFormatter text={wiki.interaction_history} />
                            </div>
                        </>
                    ) : (
                        <TextFormatter text={wiki.content} />
                    )}
                </div>
            </div>
        </div>
    </div>
);


// --- Blog Section ---
const BlogSection = ({ onSelectBlog }) => {
    const [items, setItems] = useState([]);
    const [modalState, setModalState] = useState({isOpen: false, item: null});
    const collectionPath = `/artifacts/${appId}/public/data/blogs`;

    useEffect(() => {
        const q = query(collection(db, collectionPath));
        const unsub = onSnapshot(q, (snapshot) => setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [collectionPath]);

    const handleSave = async (data) => {
        if(modalState.item){
            await setDoc(doc(db, collectionPath, modalState.item.id), data, {merge: true});
        } else {
            await addDoc(collection(db, collectionPath), { ...data, creatorId: getUserId(), createdAt: new Date() });
        }
    };

    const handleDelete = async (itemId) => {
        await deleteDoc(doc(db, collectionPath, itemId));
    };
    
    const handleEdit = (item) => {
        setModalState({isOpen: true, item: item})
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <Newspaper size={32} className="text-yellow-400" />
                    <h2 className="text-3xl font-orbitron text-yellow-400 ml-3">Data Logs</h2>
                </div>
                <button onClick={() => setModalState({isOpen: true, item: null})} className="flex items-center bg-yellow-400 text-black px-4 py-2 rounded-md hover:bg-yellow-300 transition-colors">
                    <Plus size={20} className="mr-2" /> Create Post
                </button>
            </div>

            {modalState.isOpen && <CreateEditModal onFinish={() => setModalState({isOpen: false, item: null})} onSave={handleSave} item={modalState.item} fields={[
                { name: 'name', placeholder: 'Post Title'},
                { name: 'content', placeholder: 'Content', type: 'textarea' },
                { name: 'coverUrl', placeholder: 'Cover Image URL (Optional)'}
            ]} title="Data Log" />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => <ItemCard key={item.id} item={item} onSelectItem={onSelectBlog} onEdit={handleEdit} onDelete={handleDelete} />)}
            </div>
        </div>
    );
};

const BlogPost = ({ blog, goBack }) => (
     <div>
        <div className="flex items-center mb-4">
            <button onClick={goBack} className="mr-4 p-2 rounded-full hover:bg-slate-700"><ChevronRight className="rotate-180" size={24} /></button>
            <h2 className="text-3xl font-orbitron text-yellow-400">{blog.name}</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">By User: {blog.authorId}</p>
        <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-yellow-400 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
             <TextFormatter text={blog.content}/>
        </div>
    </div>
);

// --- Profile Section ---
const ProfileSection = ({ user, userData }) => {
    const [displayName, setDisplayName] = useState(userData.displayName || '');
    const [photoURL, setPhotoURL] = useState(userData.photoURL || '');
    const [bannerUrl, setBannerUrl] = useState(userData.bannerUrl || '');
    const [message, setMessage] = useState('');

    useEffect(() => {
        setDisplayName(userData.displayName || '');
        setPhotoURL(userData.photoURL || '');
        setBannerUrl(userData.bannerUrl || '');
    }, [userData]);
    
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        if (!user) return;
        
        const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/profile`, 'data');
        const profileData = {
            displayName: displayName.trim(),
            photoURL: photoURL.trim(),
            bannerUrl: bannerUrl.trim(),
        };

        try {
            await setDoc(userDocRef, profileData, { merge: true });
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error updating profile: ", error);
            setMessage('Error updating profile.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div>
            <div className="flex items-center mb-6">
                <Settings size={32} className="text-yellow-400" />
                <h2 className="text-3xl font-orbitron text-yellow-400 ml-3">Customize Profile</h2>
            </div>
            <form onSubmit={handleProfileUpdate} className="max-w-xl mx-auto bg-slate-800 p-6 rounded-lg border border-slate-700">
                <div className="mb-4">
                    <label className="block text-yellow-400 mb-2" htmlFor="displayName">Display Name</label>
                    <input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g., 'Han Solo'" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                 <div className="mb-4">
                    <label className="block text-yellow-400 mb-2" htmlFor="photoURL">Profile Picture URL</label>
                    <input id="photoURL" type="text" value={photoURL} onChange={e => setPhotoURL(e.target.value)} placeholder="https://example.com/my-avatar.png" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                 <div className="mb-6">
                    <label className="block text-yellow-400 mb-2" htmlFor="bannerUrl">Banner URL</label>
                    <input id="bannerUrl" type="text" value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://example.com/my-banner.png" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <button type="submit" className="w-full bg-yellow-400 text-black font-bold py-2 px-4 rounded-md hover:bg-yellow-300 transition-colors">Save Changes</button>
                {message && <p className={`mt-4 text-center ${message.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}
            </form>
        </div>
    );
};

// --- Galaxy Map Section ---
const GalaxyMapSection = ({ onSelectChatroom }) => {
    const [mapPoints, setMapPoints] = useState([]);
    const [chatrooms, setChatrooms] = useState([]);
    const [modalState, setModalState] = useState({isOpen: false, item: null});
    
    const mapPointsCollectionPath = `/artifacts/${appId}/public/data/mappoints`;
    const chatroomsCollectionPath = `/artifacts/${appId}/public/data/chatrooms`;

    useEffect(() => {
        const mapUnsub = onSnapshot(query(collection(db, mapPointsCollectionPath)), (snapshot) => {
            setMapPoints(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const chatUnsub = onSnapshot(query(collection(db, chatroomsCollectionPath)), (snapshot) => {
            setChatrooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { mapUnsub(); chatUnsub(); };
    }, [mapPointsCollectionPath, chatroomsCollectionPath]);

    const handlePlanetClick = (point) => {
        if (point.linkedChatroomId) {
            const chatroom = chatrooms.find(c => c.id === point.linkedChatroomId);
            if (chatroom) {
                onSelectChatroom(chatroom);
            }
        }
    };
    
    const handleEditPoint = (e, point) => {
        e.stopPropagation();
        setModalState({ isOpen: true, item: point });
    };

    const handleDeletePoint = async (e, pointId) => {
        e.stopPropagation();
        await deleteDoc(doc(db, mapPointsCollectionPath, pointId));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center">
                    <Map size={32} className="text-yellow-400" />
                    <h2 className="text-3xl font-orbitron text-yellow-400 ml-3">Galaxy Map</h2>
                </div>
                <button onClick={() => setModalState({isOpen: true, item: null})} className="flex items-center bg-yellow-400 text-black px-4 py-2 rounded-md hover:bg-yellow-300 transition-colors">
                    <Plus size={20} className="mr-2" /> Add Planet
                </button>
            </div>

            {modalState.isOpen && <CreateEditMapPoint onFinish={() => setModalState({isOpen: false, item: null})} chatrooms={chatrooms} pointToEdit={modalState.item} />}
            
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                <img src="https://cdna.artstation.com/p/assets/images/images/027/099/014/large/alex-jay-perfect-galaxy-map-no-grid.jpg?1590597368" alt="Galaxy Map" className="absolute top-0 left-0 w-full h-full object-cover"/>
                <svg viewBox="0 0 1000 562.5" className="absolute top-0 left-0 w-full h-full">
                    {mapPoints.map(point => (
                        <g key={point.id} onClick={() => handlePlanetClick(point)} className="cursor-pointer group">
                            <circle cx={`${point.x}%`} cy={`${point.y}%`} r="8" fill="rgba(255, 255, 0, 0.7)" stroke="white" strokeWidth="1" className="transition-all duration-200 group-hover:r-12 group-hover:fill-yellow-300" />
                            <text x={`${point.x}%`} y={`${point.y}%`} dy="-20" textAnchor="middle" fill="white" className="font-orbitron text-base pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100" style={{filter: 'drop-shadow(0 0 2px black)'}}>{point.name}</text>
                           <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <rect x={`${Number(point.x) + 1.5}%`} y={`${point.y-2}%`} width="30" height="15" rx="5" fill="rgba(0,0,0,0.5)" />
                                <text x={`${Number(point.x) + 2.2}%`} y={`${point.y-0.8}%`} fill="white" className="pointer-events-none" fontSize="8">
                                    <tspan className="cursor-pointer" onClick={(e) => handleEditPoint(e, point)}>Edit</tspan>
                                </text>
                           </g>
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

const CreateEditMapPoint = ({ onFinish, chatrooms, pointToEdit }) => {
    const [name, setName] = useState(pointToEdit?.name || '');
    const [x, setX] = useState(pointToEdit?.x || 50);
    const [y, setY] = useState(pointToEdit?.y || 50);
    const [linkedChatroomId, setLinkedChatroomId] = useState(pointToEdit?.linkedChatroomId || '');
    
    const mapPointsCollectionPath = `/artifacts/${appId}/public/data/mappoints`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = { name: name.trim(), x: Number(x), y: Number(y), linkedChatroomId };
        if(!data.name) return;

        try {
            if (pointToEdit) {
                await setDoc(doc(db, mapPointsCollectionPath, pointToEdit.id), data, { merge: true });
            } else {
                await addDoc(collection(db, mapPointsCollectionPath), data);
            }
            onFinish();
        } catch (error) {
            console.error("Error saving map point:", error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-lg w-full max-w-md border border-yellow-400 relative">
                 <button type="button" onClick={onFinish} className="absolute top-3 right-3 text-slate-400 hover:text-white"><X size={24} /></button>
                 <h3 className="text-2xl font-orbitron mb-4 text-yellow-400">{pointToEdit ? 'Edit Planet' : 'Add Planet'}</h3>

                 <label className="block text-yellow-400 mb-1 mt-4 text-sm" htmlFor="name">Planet Name</label>
                 <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Tatooine" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                 
                 <label className="block text-yellow-400 mb-1 mt-4 text-sm" htmlFor="x-coord">X Coordinate (%)</label>
                 <input id="x-coord" type="range" min="0" max="100" value={x} onChange={e => setX(e.target.value)} className="w-full"/>
                 
                 <label className="block text-yellow-400 mb-1 mt-4 text-sm" htmlFor="y-coord">Y Coordinate (%)</label>
                 <input id="y-coord" type="range" min="0" max="100" value={y} onChange={e => setY(e.target.value)} className="w-full"/>

                 <label className="block text-yellow-400 mb-1 mt-4 text-sm" htmlFor="chatroom-link">Link to Chatroom (Optional)</label>
                 <select id="chatroom-link" value={linkedChatroomId} onChange={e => setLinkedChatroomId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    <option value="">None</option>
                    {chatrooms.map(room => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                 </select>

                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onFinish} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-md bg-yellow-400 text-black hover:bg-yellow-300">Save</button>
                </div>
            </form>
        </div>
    );
};
