import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { 
  Users, MessageSquare, Megaphone, Calendar, Shield, LogOut, Heart, 
  Send, Plus, Trash2, ShieldAlert, Check, X, Search, Globe, ChevronRight 
} from 'lucide-react'

export default function App() {
  // Navigation & Session State
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [currentTab, setCurrentTab] = useState('FEED') // FEED, PUBLIC_LOUNGE, GROUPS, EVENTS, ADMIN
  const [loading, setLoading] = useState(true)
  const [missingEnv, setMissingEnv] = useState(false)

  // Auth Inputs
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [authError, setAuthError] = useState('')
  const [setupProfileMode, setSetupProfileMode] = useState(false)

  // Database States
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [newPostContent, setNewPostContent] = useState('')
  const [newCommentContent, setNewCommentContent] = useState('')

  // Conversations & Members
  const [members, setMembers] = useState([])
  const [selectedMate, setSelectedMate] = useState(null) // Direct Chat Target
  const [directMessages, setDirectMessages] = useState([])
  const [newDirectMsg, setNewDirectMsg] = useState('')

  // Public Lounge Messages
  const [loungeMessages, setLoungeMessages] = useState([])
  const [newLoungeMsg, setNewLoungeMsg] = useState('')

  // Group Rooms
  const [groupRooms, setGroupRooms] = useState([])
  const [activeGroup, setActiveGroup] = useState(null) // Group chat room target
  const [groupMessages, setGroupMessages] = useState([])
  const [newGroupMsg, setNewGroupMsg] = useState('')
  const [userJoinedGroups, setUserJoinedGroups] = useState(new Set())
  const [createGroupTitle, setCreateGroupTitle] = useState('')
  const [createGroupDesc, setCreateGroupDesc] = useState('')

  // Events & RVSPs
  const [events, setEvents] = useState([])
  const [eventRsvps, setEventRsvps] = useState({}) // { eventId: userRsvpStatus }
  const [createEventTitle, setCreateEventTitle] = useState('')
  const [createEventDesc, setCreateEventDesc] = useState('')
  const [createEventLoc, setCreateEventLoc] = useState('')
  const [createEventDate, setCreateEventDate] = useState('')

  // Admin and Metrics
  const [allProfiles, setAllProfiles] = useState([])

  // References for Auto-Scroll
  const loungeEndRef = useRef(null)
  const groupChatEndRef = useRef(null)
  const directChatEndRef = useRef(null)

  // Check Supabase Configuration
  useEffect(() => {
    const isMock = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
    if (isMock) {
      setMissingEnv(true)
    }
    
    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUserProfile(session.user)
      else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Auto Scroll Actions
  useEffect(() => {
    loungeEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [loungeMessages])

  useEffect(() => {
    groupChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [groupMessages])

  useEffect(() => {
    directChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [directMessages])

  // Periodic Refresh Core
  useEffect(() => {
    if (!session || !userProfile) return
    
    // Fetch initial datasets
    fetchPosts()
    fetchLoungeMessages()
    fetchGroupRooms()
    fetchEvents()
    fetchMembers()

    // 10 second polling fallback
    const id = setInterval(() => {
      fetchPosts()
      fetchLoungeMessages()
      fetchEvents()
      if (activeGroup) fetchGroupMessages(activeGroup.id)
      if (selectedMate) fetchDirectMessages(selectedMate.id)
    }, 10000)

    return () => clearInterval(id)
  }, [session, userProfile, activeGroup, selectedMate])

  // Profile management
  const fetchUserProfile = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (error && error.code === 'PGRST116') {
        setSetupProfileMode(true)
      } else if (data) {
        setUserProfile(data)
        setSetupProfileMode(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSetupSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!username.trim()) {
      setAuthError('Username is required')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const shorthandLetters = username.trim().substring(0, 6).toUpperCase()
      
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        username: username.trim(),
        shorthand: shorthandLetters,
        bio: bio.trim() || 'Hello, I am new on Mates!',
        role: 'user'
      })

      if (error) {
        setAuthError(error.message)
      } else {
        fetchUserProfile(user)
      }
    } catch (err) {
      setAuthError(err.message)
    }
  }

  // --- Authentications ---
  const handleSignIn = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (!email || !password) return
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (!email || !password || !username) {
      setAuthError('Please fill out all required fields')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() }
      }
    })

    if (error) {
      setAuthError(error.message)
      setLoading(false)
    } else if (data?.user) {
      setTimeout(() => {
        supabase.auth.signInWithPassword({ email, password }).then(() => {
          setLoading(false)
        })
      }, 1500)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUserProfile(null)
    setSelectedMate(null)
    setActiveGroup(null)
  }

  // --- Fetch Operations ---
  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:user_id (id, username, shorthand)')
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  const fetchPostComments = async (postId) => {
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles:user_id (id, username, shorthand)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const fetchLoungeMessages = async () => {
    const { data } = await supabase
      .from('public_lounge_messages')
      .select('*, profiles:user_id (username, shorthand)')
      .order('created_at', { ascending: true })
    if (data) setLoungeMessages(data)
  }

  const fetchGroupRooms = async () => {
    const { data: rooms } = await supabase.from('group_rooms').select('*').order('title')
    if (rooms) {
      setGroupRooms(rooms)
      const { data: members } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)
      if (members) {
        setUserJoinedGroups(new Set(members.map(m => m.group_id)))
      }
    }
  }

  const fetchGroupMessages = async (groupId) => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles:user_id (username, shorthand)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (data) setGroupMessages(data)
  }

  const fetchEvents = async () => {
    const { data: eventList } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    if (eventList) {
      setEvents(eventList)
      const { data: rsvpList } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('user_id', session.user.id)
      if (rsvpList) {
        const rsvpMap = {}
        rsvpList.forEach(item => {
          rsvpMap[item.event_id] = item.status
        })
        setEventRsvps(rsvpMap)
      }
    }
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('username')
    if (data) {
      setMembers(data.filter(m => m.id !== session.user.id))
      setAllProfiles(data)
    }
  }

  const fetchDirectMessages = async (partnerId) => {
    const currentUserId = session.user.id
    const { data } = await supabase
      .from('direct_chats')
      .select(`
        *,
        sender:sender_id (username, shorthand),
        receiver:receiver_id (username, shorthand)
      `)
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
    if (data) setDirectMessages(data)
  }

  // --- Interaction Triggers ---
  const createPost = async () => {
    if (!newPostContent.trim()) return
    const { error } = await supabase.from('posts').insert({
      user_id: session.user.id,
      content: newPostContent.trim()
    })
    if (!error) {
      setNewPostContent('')
      fetchPosts()
    }
  }

  const deletePost = async (postId) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (!error) fetchPosts()
  }

  const toggleLike = async (post) => {
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', session.user.id)
      .single()

    if (existingLike) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', session.user.id)
      await supabase.from('posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', post.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: session.user.id })
      await supabase.from('posts').update({ likes_count: post.likes_count + 1 }).eq('id', post.id)
    }
    fetchPosts()
  }

  const postComment = async (postId) => {
    if (!newCommentContent.trim()) return
    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: session.user.id,
      content: newCommentContent.trim()
    })
    if (!error) {
      setNewCommentContent('')
      fetchPostComments(postId)
    }
  }

  const sendLoungeMessage = async () => {
    if (!newLoungeMsg.trim()) return
    const { error } = await supabase.from('public_lounge_messages').insert({
      user_id: session.user.id,
      content: newLoungeMsg.trim()
    })
    if (!error) {
      setNewLoungeMsg('')
      fetchLoungeMessages()
    }
  }

  const createGroup = async () => {
    if (!createGroupTitle.trim()) return
    const { data } = await supabase.from('group_rooms').insert({
      title: createGroupTitle.trim(),
      description: createGroupDesc.trim(),
      created_by: session.user.id
    }).select().single()

    if (data) {
      await supabase.from('group_members').insert({ group_id: data.id, user_id: session.user.id })
      setCreateGroupTitle('')
      setCreateGroupDesc('')
      fetchGroupRooms()
    }
  }

  const joinGroup = async (groupId) => {
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: session.user.id
    })
    if (!error) fetchGroupRooms()
  }

  const leaveGroup = async (groupId) => {
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', session.user.id)
    if (!error) {
      if (activeGroup && activeGroup.id === groupId) setActiveGroup(null)
      fetchGroupRooms()
    }
  }

  const sendGroupMessage = async () => {
    if (!newGroupMsg.trim() || !activeGroup) return
    const { error } = await supabase.from('group_messages').insert({
      group_id: activeGroup.id,
      user_id: session.user.id,
      content: newGroupMsg.trim()
    })
    if (!error) {
      setNewGroupMsg('')
      fetchGroupMessages(activeGroup.id)
    }
  }

  const sendDirectMessage = async () => {
    if (!newDirectMsg.trim() || !selectedMate) return
    const { error } = await supabase.from('direct_chats').insert({
      sender_id: session.user.id,
      receiver_id: selectedMate.id,
      content: newDirectMsg.trim()
    })
    if (!error) {
      setNewDirectMsg('')
      fetchDirectMessages(selectedMate.id)
    }
  }

  const createMeetupEvent = async () => {
    if (!createEventTitle.trim() || !createEventLoc || !createEventDate) return
    const { error } = await supabase.from('events').insert({
      title: createEventTitle.trim(),
      description: createEventDesc.trim(),
      location: createEventLoc.trim(),
      date_str: createEventDate,
      created_by: session.user.id
    })
    if (!error) {
      setCreateEventTitle('')
      setCreateEventDesc('')
      setCreateEventLoc('')
      setCreateEventDate('')
      fetchEvents()
    }
  }

  const submitEventRsvp = async (eventId, status) => {
    const existing = eventRsvps[eventId]
    if (existing) {
      await supabase.from('event_rsvps').update({ status }).eq('event_id', eventId).eq('user_id', session.user.id)
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: session.user.id, status })
    }
    fetchEvents()
  }
// --- RENDERING VIEWS ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slateDark-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primaryAqua mb-4"></div>
          <p className="text-slate-400 font-mono text-sm">Spawning Mates social universe...</p>
        </div>
      </div>
    )
  }

  if (missingEnv) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slateDark-950 p-6">
        <div className="max-w-md w-full bg-slateDark-900 border border-slateDark-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="inline-flex items-center justify-center p-3 bg-red-950/40 text-accentPink border border-red-900/50 rounded-2xl mb-5">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">Missing Environmental Keys</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Mates Web requires a functional connection to your Supabase project. Setup your environment variables inside the 
            <code className="px-1.5 py-0.5 bg-slateDark-800 rounded font-mono text-xs mx-1 text-primaryAqua">.env</code> 
            using:
          </p>
          <div className="bg-slateDark-950 p-4 rounded-2xl border border-slateDark-800 text-left font-mono text-xs leading-5 text-slate-300 mb-6 space-y-1">
            <span className="text-slate-500"># React App client configuration</span>
            <div>VITE_SUPABASE_URL=YOUR_SUPABASE_URL</div>
            <div>VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_KEY</div>
          </div>
          <button 
            onClick={() => setMissingEnv(false)}
            className="w-full py-3 px-4 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 font-bold rounded-2xl tracking-wide transition-all shadow-md shadow-primaryAqua/20"
          >
            I Configured It, Proceed anyway
          </button>
        </div>
      </div>
    )
  }

  if (setupProfileMode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slateDark-950 p-6">
        <form onSubmit={handleProfileSetupSubmit} className="max-w-md w-full bg-slateDark-900 border border-slateDark-800 rounded-3xl p-8 shadow-2xl font-sans">
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">Configure Profile</h2>
          <p className="text-slate-400 text-sm mb-6">Let other Mates know who you are by completing your credentials.</p>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Mates Username</label>
              <input 
                type="text" 
                placeholder="sarakim"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl text-white text-sm focus:outline-none focus:border-primaryAqua transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1.5">Profile Biography</label>
              <textarea 
                placeholder="Share about your interests, communities, and meetup goals..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl text-white text-sm focus:outline-none focus:border-primaryAqua transition resize-none"
              />
            </div>
          </div>

          {authError && <p className="text-xs text-accentPink mb-4 bg-red-950/20 px-3 py-2.5 rounded-xl border border-red-900/30">{authError}</p>}

          <button 
            type="submit" 
            className="w-full py-3 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 font-bold rounded-2xl tracking-wide transition shadow"
          >
            Build My Identity
          </button>
        </form>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slateDark-950 p-6 font-sans">
        <div className="max-w-md w-full bg-slateDark-900 border border-slateDark-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-5xl mb-2 inline-block">🤝</span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Mates Web</h1>
            <p className="text-slate-400 text-sm mt-1">Premium social network linked to Supabase</p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Username</label>
                <input 
                  type="text" 
                  placeholder="sarakim"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl text-white text-sm focus:outline-none focus:border-primaryAqua transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
              <input 
                type="email" 
                placeholder="mate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl text-white text-sm focus:outline-none focus:border-primaryAqua transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl text-white text-sm focus:outline-none focus:border-primaryAqua transition"
                required
              />
            </div>

            {authError && (
              <p className="text-xs text-accentPink bg-red-950/25 border border-red-900/40 p-3 rounded-xl">
                {authError}
              </p>
            )}

            <button 
              type="submit" 
              className="w-full py-3.5 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 font-bold rounded-2xl tracking-wide transition shadow"
            >
              {isSignUp ? 'Create Premium Account' : 'Authenticate Into Workspace'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm border-t border-slateDark-800/60 pt-5">
            <span className="text-slate-400">
              {isSignUp ? 'Already have an account?' : 'New comrade on the grid?'}
            </span>
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAuthError('')
              }}
              className="text-primaryAqua pl-1.5 font-semibold hover:underline"
            >
              {isSignUp ? 'Log in instead' : 'Join Mates'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slateDark-950 font-sans">
      
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-72 bg-slateDark-900 border-r border-slateDark-800 flex flex-col">
        <div className="p-6 border-b border-slateDark-800/60 flex items-center gap-3">
          <span className="text-3xl">🧑‍🤝‍🧑</span>
          <div>
            <h1 className="text-lg font-extrabold text-white leading-tight">Mates Hub</h1>
            <span className="text-[10px] font-mono text-slate-400 uppercase bg-slateDark-850 px-1.5 py-0.5 rounded tracking-wider">Premium Web</span>
          </div>
        </div>

        <div className="px-5 py-4 flex items-center gap-3 border-b border-slateDark-800">
          <div className="w-10 h-10 bg-primaryAqua text-slateDark-950 rounded-full font-bold text-xs flex items-center justify-center leading-none tracking-tight">
            {userProfile?.shorthand?.substring(0, 3)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">@{userProfile?.username}</p>
            <p className="text-xs text-slate-400 truncate">{userProfile?.bio || 'Mates member'}</p>
          </div>
          {userProfile?.role === 'admin' && (
            <span className="p-1 px-1.5 bg-amber-500/10 text-amber-400 font-mono text-[9px] rounded-md font-bold uppercase tracking-widest border border-amber-500/20">Admin</span>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button 
            onClick={() => { setCurrentTab('FEED'); setSelectedMate(null); setActiveGroup(null) }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${currentTab === 'FEED' && !selectedMate && !activeGroup ? 'bg-slateDark-800 text-primaryAqua font-bold border-l-4 border-primaryAqua' : 'text-slate-300 hover:bg-slateDark-850'}`}
          >
            <Globe size={18} /> Social Feed
          </button>
          
          <button 
            onClick={() => { setCurrentTab('PUBLIC_LOUNGE'); setSelectedMate(null); setActiveGroup(null) }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${currentTab === 'PUBLIC_LOUNGE' ? 'bg-slateDark-800 text-primaryAqua font-bold border-l-4 border-primaryAqua' : 'text-slate-300 hover:bg-slateDark-850'}`}
          >
            <MessageSquare size={18} /> Public Lounge
          </button>

          <button 
            onClick={() => { setCurrentTab('GROUPS'); setSelectedMate(null); setActiveGroup(null) }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${currentTab === 'GROUPS' ? 'bg-slateDark-800 text-primaryAqua font-bold border-l-4 border-primaryAqua' : 'text-slate-300 hover:bg-slateDark-850'}`}
          >
            <Users size={18} /> Group Chats
          </button>

          <button 
            onClick={() => { setCurrentTab('EVENTS'); setSelectedMate(null); setActiveGroup(null) }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${currentTab === 'EVENTS' ? 'bg-slateDark-800 text-primaryAqua font-bold border-l-4 border-primaryAqua' : 'text-slate-300 hover:bg-slateDark-850'}`}
          >
            <Calendar size={18} /> Meetup Events
          </button>

          {userProfile?.role === 'admin' && (
            <button 
              onClick={() => { setCurrentTab('ADMIN'); setSelectedMate(null); setActiveGroup(null) }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${currentTab === 'ADMIN' ? 'bg-slateDark-800 text-amber-400 font-bold border-l-4 border-amber-500' : 'text-slate-300 hover:bg-slateDark-850'}`}
            >
              <Shield size={18} /> Admin Suite
            </button>
          )}

          <div className="pt-6">
            <span className="px-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Direct Chats</span>
            <div className="space-y-0.5">
              {members.length === 0 ? (
                <p className="px-4 py-2 text-xs text-slate-500 italic">No other mates found...</p>
              ) : (
                members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => { setSelectedMate(member); setActiveGroup(null) }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs transition ${selectedMate?.id === member.id ? 'bg-primaryAqua/10 text-primaryAqua font-bold' : 'text-slate-400 hover:bg-slateDark-850'}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-slateDark-850 text-slate-300 border border-slateDark-800 font-bold flex items-center justify-center text-[9px]">
                      {member.shorthand?.substring(0, 2)}
                    </div>
                    <span className="truncate flex-1 text-left">@{member.username}</span>
                    {selectedMate?.id === member.id && <ChevronRight size={12} className="text-primaryAqua" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slateDark-800/60">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 hover:bg-red-950/20 text-accentPink border border-transparent hover:border-red-950/40 rounded-2xl text-sm font-medium transition"
          >
            <LogOut size={16} /> Sign out Grid
          </button>
        </div>
      </aside>
      {/* 2. CHAT PANEL AND MAIN SCREENS */}
      <main className="flex-1 flex flex-col bg-slateDark-950 overflow-hidden relative">
        <header className="h-16 border-b border-slateDark-800/80 bg-slateDark-900/65 backdrop-blur px-6 flex items-center justify-between">
          <h2 className="text-md font-extrabold text-white flex items-center gap-2">
            {selectedMate ? (
              <>
                <span className="text-slate-400">Direct Chat with</span> 
                <span className="text-primaryAqua">@{selectedMate.username}</span>
              </>
            ) : activeGroup ? (
              <>
                <span className="text-slate-400">Community Channel</span> 
                <span className="text-primaryAqua font-mono">#{activeGroup.title}</span>
              </>
            ) : (
              currentTab === 'FEED' ? 'Mates Community Feed' :
              currentTab === 'PUBLIC_LOUNGE' ? 'Public Lounge Room' :
              currentTab === 'GROUPS' ? 'Comrade Group Rooms' :
              currentTab === 'EVENTS' ? 'Premium Meetups & RSVPs' : 'Admin Operations Control Room'
            )}
          </h2>
          <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-900/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            CONNECTED GRID
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {selectedMate ? (
            /* --- RENDER DIRECT CHATS --- */
            <div className="flex flex-col h-full bg-slateDark-950">
              <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-10rem)]">
                {directMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <span className="text-4xl mb-3">💬</span>
                    <p className="text-sm font-medium text-slate-400">Establish the gateway!</p>
                    <p className="text-xs text-slate-500 mt-1">Send a message to start direct chat with @{selectedMate.username}</p>
                  </div>
                ) : (
                  directMessages.map((msg) => {
                    const isOwn = msg.sender_id === session.user.id
                    return (
                      <div key={msg.id} className={`flex max-w-xl ${isOwn ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                        <div className={`p-4 rounded-3xl ${isOwn ? 'bg-primaryAqua text-slateDark-950 rounded-tr-none' : 'bg-slateDark-900 text-white border border-slateDark-800 rounded-tl-none shadow-sm'}`}>
                          {!isOwn && (
                            <span className="block text-[10px] font-mono text-primaryAqua font-bold uppercase tracking-widest mb-1">
                              {msg.sender?.username}
                            </span>
                          )}
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <span className={`block text-[9px] text-right mt-1.5 ${isOwn ? 'text-slateDark-950/60' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={directChatEndRef} />
              </div>

              <div className="p-4 bg-slateDark-900 border-t border-slateDark-800/80 sticky bottom-0">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={`Write your direct dispatch to @${selectedMate.username}...`}
                    value={newDirectMsg}
                    onChange={(e) => setNewDirectMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendDirectMessage()}
                    className="flex-1 px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:border-primaryAqua transition rounded-2xl focus:outline-none text-sm text-slate-300"
                  />
                  <button 
                    onClick={sendDirectMessage}
                    className="px-5 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl transition flex items-center justify-center font-bold"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>

          ) : activeGroup ? (
            /* --- RENDER GROUP CHATS ROOM --- */
            <div className="flex flex-col h-full">
              <div className="bg-slateDark-900/50 p-4 border-b border-slateDark-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">#{activeGroup.title}</h3>
                  <p className="text-xs text-slate-400">{activeGroup.description || 'Active lobby'}</p>
                </div>
                <button 
                  onClick={() => leaveGroup(activeGroup.id)}
                  className="px-3 py-1.5 border border-red-900/30 text-accentPink text-xs font-mono rounded-xl hover:bg-red-950/20"
                >
                  Leave Channel
                </button>
              </div>

              <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-14rem)]">
                {groupMessages.length === 0 ? (
                  <div className="text-center py-20">
                    <span className="text-4xl mb-3 block">💬</span>
                    <p className="text-sm text-slate-400">Silent chamber. Break the barrier by posting the initiating transmit!</p>
                  </div>
                ) : (
                  groupMessages.map((msg) => {
                    const isOwn = msg.user_id === session.user.id
                    return (
                      <div key={msg.id} className={`flex max-w-xl ${isOwn ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                        <div className={`p-4 rounded-3xl ${isOwn ? 'bg-slateDark-800 border-r-4 border-primaryAqua text-white rounded-tr-none' : 'bg-slateDark-900 text-white border border-slateDark-800 rounded-tl-none'}`}>
                          <span className="block text-[10px] font-mono text-primaryAqua font-bold uppercase tracking-widest mb-1 text-left">
                            @{msg.profiles?.username}
                          </span>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <span className="block text-[9px] text-right mt-1.5 text-slate-500">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={groupChatEndRef} />
              </div>

              <div className="p-4 bg-slateDark-900 border-t border-slateDark-800 sticky bottom-0">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={`Transmit message to #${activeGroup.title}...`}
                    value={newGroupMsg}
                    onChange={(e) => setNewGroupMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendGroupMessage()}
                    className="flex-1 px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:border-primaryAqua transition rounded-2xl focus:outline-none text-sm text-slate-300"
                  />
                  <button 
                    onClick={sendGroupMessage}
                    className="px-5 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl transition flex items-center justify-center"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>

          ) : (
            /* --- RENDER STANDARD TABS --- */
            <div className="p-6">
              
              {/* SOCIAL FEED TAB */}
              {currentTab === 'FEED' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-5 shadow-sm">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">Publish Social Broadcast</h3>
                    <textarea 
                      placeholder="Share a thought, project update, or general vibe check with the community..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl focus:outline-none focus:border-primaryAqua text-sm text-slate-300 transition resize-none mb-3"
                    />
                    <div className="flex justify-end">
                      <button 
                        onClick={createPost}
                        className="py-2.5 px-6 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl font-bold text-sm tracking-wide transition flex items-center gap-2"
                      >
                        <Megaphone size={16} /> Launch Post
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {posts.length === 0 ? (
                      <div className="text-center py-12 bg-slateDark-900/40 rounded-3xl border border-slateDark-800">
                        <span className="text-3xl block mb-2">📰</span>
                        <p className="text-sm text-slate-400">Social grid is static. Launch the first broadcast!</p>
                      </div>
                    ) : (
                      posts.map((post) => (
                        <div key={post.id} className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slateDark-850 border border-slateDark-800 text-primaryAqua text-xs font-bold flex items-center justify-center">
                                {post.profiles?.shorthand?.substring(0, 2)}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-white block">@{post.profiles?.username}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {new Date(post.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            
                            {(post.user_id === session.user.id || userProfile?.role === 'admin') && (
                              <button 
                                onClick={() => deletePost(post.id)}
                                className="p-1.5 hover:bg-red-950/20 text-slate-500 hover:text-accentPink rounded-xl transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>

                          <p className="text-sm text-slate-200 leading-relaxed mb-4">{post.content}</p>
                          
                          <div className="flex items-center gap-4 pt-4 border-t border-slateDark-800">
                            <button 
                              onClick={() => toggleLike(post)}
                              className="flex items-center gap-2 text-xs font-bold font-mono text-slate-400 hover:text-accentPink transition"
                            >
                              <Heart size={16} className="text-accentPink" fill={post.likes_count > 0 ? "currentColor" : "none"} />
                              <span>{post.likes_count} Likes</span>
                            </button>

                            <button 
                              onClick={() => { setSelectedPost(post); fetchPostComments(post.id) }}
                              className="flex items-center gap-2 text-xs font-bold font-mono text-slate-400 hover:text-primaryAqua transition"
                            >
                              <MessageSquare size={16} />
                              <span>Comments</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PUBLIC LOUNGE TAB */}
              {currentTab === 'PUBLIC_LOUNGE' && (
                <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl flex flex-col h-[calc(100vh-11rem)] max-w-4xl mx-auto overflow-hidden">
                  <div className="bg-slateDark-850/60 p-4 border-b border-slateDark-800 flex items-center gap-3">
                    <span className="p-1 bg-primaryAqua/10 rounded-lg text-primaryAqua"><Globe size={18} /></span>
                    <div>
                      <h3 className="text-sm font-bold text-white">Public Lounge Room</h3>
                      <p className="text-[11px] text-slate-400">Open sandbox lobby for everyone on the network.</p>
                    </div>
                  </div>

                  <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                    {loungeMessages.length === 0 ? (
                      <div className="text-center py-20 text-slate-500 font-mono text-xs">
                        Lounge is empty. Sprout the conversation stream now!
                      </div>
                    ) : (
                      loungeMessages.map((msg) => {
                        const isOwn = msg.user_id === session.user.id
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-4 rounded-2xl max-w-lg ${isOwn ? 'bg-primaryAqua text-slateDark-950 rounded-tr-none' : 'bg-slateDark-950 text-slate-300 border border-slateDark-800 rounded-tl-noneShadow'}`}>
                              <span className="block text-[10px] font-mono font-bold uppercase tracking-widest mb-1 text-slate-400">
                                @{msg.profiles?.username}
                              </span>
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <span className="block text-[8px] text-right mt-1.5 opacity-60">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={loungeEndRef} />
                  </div>

                  <div className="p-4 bg-slateDark-950 border-t border-slateDark-800 flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Press enter or tap send to broadcast to public lounge..."
                      value={newLoungeMsg}
                      onChange={(e) => setNewLoungeMsg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendLoungeMessage()}
                      className="flex-1 px-4 py-3 bg-slateDark-900 border border-slateDark-800 focus:border-primaryAqua transition rounded-2xl text-sm focus:outline-none text-slate-200"
                    />
                    <button 
                      onClick={sendLoungeMessage}
                      className="px-5 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl font-bold transition flex items-center justify-center"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* GROUPS TAB */}
              {currentTab === 'GROUPS' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">Create Community Guild Room</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input 
                        type="text" 
                        placeholder="Guild Room Title (e.g., Chess Knights)"
                        value={createGroupTitle}
                        onChange={(e) => setCreateGroupTitle(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:border-primaryAqua focus:outline-none rounded-2xl text-sm text-slate-300"
                      />
                      <input 
                        type="text" 
                        placeholder="Description"
                        value={createGroupDesc}
                        onChange={(e) => setCreateGroupDesc(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:border-primaryAqua focus:outline-none rounded-2xl text-sm text-slate-300"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={createGroup}
                        className="py-2.5 px-6 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl font-bold text-sm transition flex items-center gap-2"
                      >
                        <Plus size={16} /> Establish Channel
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupRooms.map((room) => {
                      const isMember = userJoinedGroups.has(room.id)
                      return (
                        <div key={room.id} className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-5 flex flex-col justify-between">
                          <div>
                            <h4 className="text-md font-bold text-white mb-1 flex items-center gap-1.5">
                              <span className="text-primaryAqua">#</span>{room.title}
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed mb-4">{room.description || 'Welcome!'}</p>
                          </div>

                          <div className="flex gap-2">
                            {isMember ? (
                              <>
                                <button 
                                  onClick={() => { setActiveGroup(room); fetchGroupMessages(room.id) }}
                                  className="flex-1 py-2 bg-slateDark-800 hover:bg-slateDark-750 text-primaryAqua border border-primaryAqua/20 font-bold rounded-xl text-xs transition"
                                >
                                  Enter Chat
                                </button>
                                <button 
                                  onClick={() => leaveGroup(room.id)}
                                  className="p-2 border border-slate-700/60 hover:border-red-900 text-slate-400 hover:text-accentPink rounded-xl transition"
                                  title="Leave Guild"
                                >
                                  <LogOut size={14} />
                                </button>
                              </>
                            ) : (
                              <button 
                                  onClick={() => joinGroup(room.id)}
                                  className="w-full py-2 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 font-bold rounded-xl text-xs transition"
                              >
                                Join Room Lobby
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* EVENTS TAB */}
              {currentTab === 'EVENTS' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">Schedule Community Meetup Event</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input 
                        type="text" 
                        placeholder="Event Title"
                        value={createEventTitle}
                        onChange={(e) => setCreateEventTitle(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:outline-none focus:border-primaryAqua rounded-2xl text-sm text-slate-300"
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="Location (e.g., Central Park / Zoom)"
                        value={createEventLoc}
                        onChange={(e) => setCreateEventLoc(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:outline-none focus:border-primaryAqua rounded-2xl text-sm text-slate-300"
                        required
                      />
                      <input 
                        type="date" 
                        value={createEventDate}
                        onChange={(e) => setCreateEventDate(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:outline-none focus:border-primaryAqua rounded-2xl text-sm text-slate-300 font-mono"
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="Brief summary sentence..."
                        value={createEventDesc}
                        onChange={(e) => setCreateEventDesc(e.target.value)}
                        className="px-4 py-3 bg-slateDark-950 border border-slateDark-800 focus:outline-none focus:border-primaryAqua rounded-2xl text-sm text-slate-300"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={createMeetupEvent}
                        className="py-2.5 px-6 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl font-bold text-sm transition flex items-center gap-2"
                      >
                        <Plus size={16} /> Broadcast Event
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {events.map((event) => {
                      const currentRsvp = eventRsvps[event.id] || 'DECLINED'
                      return (
                        <div key={event.id} className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between font-sans">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-primaryAqua/10 rounded-lg text-primaryAqua"><Calendar size={16} /></span>
                              <h4 className="text-md font-extrabold text-white">{event.title}</h4>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">{event.description || 'Enjoy community activities!'}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono text-slate-400">
                              <div>📍 Location: <span className="text-slate-300">{event.location}</span></div>
                              <div>📅 Meetup: <span className="text-slate-300">{event.date_str}</span></div>
                            </div>
                          </div>

                          <div className="bg-slateDark-950 border border-slateDark-800 rounded-2xl p-4 flex flex-col gap-2 min-w-[200px]">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Set My RSVP</span>
                            <div className="flex flex-col gap-1.5">
                              {['GOING', 'INTERESTED', 'DECLINED'].map((status) => {
                                const isActive = currentRsvp === status
                                return (
                                  <button
                                    key={status}
                                    onClick={() => submitEventRsvp(event.id, status)}
                                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold transition ${isActive ? 'bg-primaryAqua text-slateDark-950' : 'bg-slateDark-900 text-slate-400 hover:text-white'}`}
                                  >
                                    <span>{status}</span>
                                    {isActive && <Check size={12} />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ADMIN PANEL */}
              {currentTab === 'ADMIN' && userProfile?.role === 'admin' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl p-6">
                    <h3 className="text-lg font-extrabold text-white mb-2 flex items-center gap-2">
                      <ShieldAlert size={20} className="text-amber-400" /> Administrative Hub Operations
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                      Welcome to the moderation deck. Check metrics register lists, and adjust security details.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-slateDark-950 border border-slateDark-800 rounded-2xl">
                        <span className="text-xs text-slate-500 block uppercase font-mono mb-1">Accounts</span>
                        <span className="text-2xl font-extrabold text-white">{allProfiles.length} Members</span>
                      </div>
                      <div className="p-4 bg-slateDark-950 border border-slateDark-800 rounded-2xl">
                        <span className="text-xs text-slate-500 block uppercase font-mono mb-1">Guild Chambers</span>
                        <span className="text-2xl font-extrabold text-white">{groupRooms.length} Active</span>
                      </div>
                      <div className="p-4 bg-slateDark-950 border border-slateDark-800 rounded-2xl">
                        <span className="text-xs text-slate-500 block uppercase font-mono mb-1">Posts Ledger</span>
                        <span className="text-2xl font-extrabold text-white">{posts.length} Posts</span>
                      </div>
                    </div>

                    <h4 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3 font-semibold">Comrade Registry Database</h4>
                    <div className="bg-slateDark-950 border border-slateDark-800 rounded-2xl overflow-hidden divide-y divide-slateDark-800">
                      {allProfiles.map((prof) => (
                        <div key={prof.id} className="p-4 flex items-center justify-between text-sm">
                          <div>
                            <span className="font-bold text-white block">@{prof.username}</span>
                            <span className="text-xs text-slate-500 font-mono">UID: {prof.id}</span>
                          </div>
                          <span className="px-2.5 py-1 bg-slateDark-800 rounded-lg text-xs font-mono uppercase text-slate-400">{prof.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* FLOATING DETAIL COMMENT OVERLAYS */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slateDark-950/80 backdrop-blur flex items-center justify-center p-6 z-50">
          <div className="bg-slateDark-900 border border-slateDark-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slateDark-800 flex justify-between items-center bg-slateDark-850">
              <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest">Broadcast Comment Feed</h3>
              <button 
                onClick={() => { setSelectedPost(null); setComments([]) }}
                className="p-1 px-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 border-b border-slateDark-800/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-slateDark-850 text-primaryAqua font-bold text-xs flex items-center justify-center border border-slateDark-800">
                  {selectedPost.profiles?.shorthand?.substring(0, 2)}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">@{selectedPost.profiles?.username}</span>
                  <span className="text-[9px] font-mono text-slate-500">{new Date(selectedPost.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{selectedPost.content}</p>
            </div>

            <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slateDark-950/30">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-mono text-xs">No comments found. Seed the stream!</div>
              ) : (
                comments.map((comm) => (
                  <div key={comm.id} className="bg-slateDark-950 border border-slateDark-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-slateDark-850 text-slate-300 font-bold text-[9px] flex items-center justify-center">
                        {comm.profiles?.shorthand?.substring(0, 2)}
                      </div>
                      <span className="text-xs font-extrabold text-white">@{comm.profiles?.username}</span>
                      <span className="text-[8px] text-slate-500 font-mono ml-auto">{new Date(comm.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{comm.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-slateDark-900 border-t border-slateDark-800 flex gap-2">
              <input 
                type="text" 
                placeholder="Pen your community feedback..."
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && postComment(selectedPost.id)}
                className="flex-1 px-4 py-3 bg-slateDark-950 border border-slateDark-800 rounded-2xl focus:outline-none focus:border-primaryAqua text-xs text-slate-200"
              />
              <button 
                onClick={() => postComment(selectedPost.id)}
                className="px-5 bg-primaryAqua hover:bg-primaryAqua-hover text-slateDark-950 rounded-2xl text-xs font-bold transition flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
