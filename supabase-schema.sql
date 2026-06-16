-- 16. FRIENDS SYSTEM TABLE & SECURITY POLICIES
create table public.friends (
    user_id uuid references public.profiles(id) on delete cascade not null,
    friend_id uuid references public.profiles(id) on delete cascade not null,
    status text not null default 'accepted' check (status in ('pending', 'accepted')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, friend_id)
);
