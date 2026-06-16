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
