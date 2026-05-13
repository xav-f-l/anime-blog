import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ───────────────────
// ──────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Tous", "Review", "Analyse", "News"];
const HERO_VIDEO = "gojo.mp4";

// ── HOOK AUTH ─────────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoadingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (!error && data.user) {
    await supabase.from("profiles").insert([
      {
        id: data.user.id,      // important: même id que auth user
        email: data.user.email
      }
    ]);
  }

  return error?.message || null;
};
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message || null;
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return { user, loadingAuth, signUp, signIn, signOut };
}

// ── HOOK POSTS ────────────────────────────────────────────────────────────────
function usePosts(userId) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState(new Set());

  useEffect(() => { fetchPosts(); }, []);

  useEffect(() => {
    if (!userId) return;
    supabase.from("likes").select("post_id").eq("user_id", userId)
      .then(({ data }) => {
        if (data) setLikedPosts(new Set(data.map(l => l.post_id)));
      });
  }, [userId]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*, likes(count), comments(count)")
      .order("created_at", { ascending: false });
    if (!error) setPosts(data || []);
    setLoading(false);
  };

  const addPost = async (post) => {
    const { data, error } = await supabase
      .from("posts").insert([post])
      .select("*, likes(count), comments(count)").single();
    if (!error && data) setPosts((prev) => [data, ...prev]);
  };

  const toggleLike = async (postId) => {
    if (!userId) return "login";
    if (likedPosts.has(postId)) return "already";
    const { error } = await supabase.from("likes").insert([{ post_id: postId, user_id: userId }]);
    if (!error) {
      setLikedPosts((prev) => new Set([...prev, postId]));
      setPosts((prev) => prev.map((p) =>
        p.id === postId ? { ...p, likes: [{ count: (p.likes?.[0]?.count || 0) + 1 }] } : p
      ));
    }
    return null;
  };

  return { posts, loading, addPost, toggleLike, likedPosts };
}

// ── HOOK FILTER ───────────────────────────────────────────────────────────────
function useFilter(posts) {
  const [category, setCategory] = useState("Tous");
  const [search, setSearch] = useState("");
  const filtered = posts.filter((p) => {
    const matchCat = category === "Tous" || p.category === category;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  return { filtered, category, setCategory, search, setSearch };
}

// ── HOOK COMMENTS ─────────────────────────────────────────────────────────────
function useComments(postId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    supabase.from("comments").select("*").eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setComments(data || []); setLoading(false); });
  }, [postId]);

  const addComment = async (postId, author, content) => {
    const { data, error } = await supabase
      .from("comments").insert([{ post_id: postId, author, content }])
      .select().single();
    if (!error && data) setComments((prev) => [...prev, data]);
    return !error;
  };

  return { comments, loading, addComment };
}

// ── STYLES COMMUNS ────────────────────────────────────────────────────────────
const labelStyle = { fontFamily: "'Outfit', sans-serif", color: "#ccc", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, letterSpacing: 0.5 };
const errorStyle = { fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 12, marginTop: 6 };
const baseInput = { width: "100%", background: "rgba(255,255,255,0.04)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };

// ── MODAL AUTH ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, signIn, signUp }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email.trim() || !password.trim()) { setError("Remplis tous les champs."); return; }
    setLoading(true); setError(""); setSuccess("");
    const err = mode === "login" ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (err) {
      setError(err.includes("Invalid") ? "Email ou mot de passe incorrect." : err.includes("already") ? "Cet email est déjà utilisé." : err);
    } else {
      if (mode === "register") setSuccess("✅ Compte créé ! Vérifie ton email pour confirmer.");
      else onClose();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#111122", border: "1px solid rgba(255,78,78,0.25)", borderRadius: 20, width: "100%", maxWidth: 420, padding: "2rem", position: "relative" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 32 }}>⛩️</span>
          <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "1.5rem", margin: "8px 0 4px" }}>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#666", fontSize: 14, margin: 0 }}>{mode === "login" ? "Bienvenue de retour !" : "Rejoins la communauté ANIMÛ"}</p>
        </div>
        {error && <div style={{ background: "rgba(255,78,78,0.1)", border: "1px solid rgba(255,78,78,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 13 }}>{error}</div>}
        {success && <div style={{ background: "rgba(78,255,158,0.1)", border: "1px solid #4eff9e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontFamily: "'Outfit', sans-serif", color: "#4eff9e", fontSize: 13 }}>{success}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" type="email" style={baseInput} onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={baseInput} onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <button onClick={handle} disabled={loading} style={{ background: "linear-gradient(135deg,#ff4e4e,#ff8c42)", border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer", padding: "13px", borderRadius: 30, fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, opacity: loading ? 0.7 : 1, marginTop: 4, boxShadow: "0 4px 20px rgba(255,78,78,0.3)" }}>
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#555", fontSize: 13, textAlign: "center", margin: 0 }}>
            {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }} style={{ color: "#ff4e4e", cursor: "pointer", fontWeight: 600 }}>
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
function Navbar({ page, setPage, user, onAuthClick, onSignOut }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = ["Accueil", "Blog", "À propos", "Contribuer"];

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "rgba(10,10,20,0.95)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid rgba(255,80,80,0.15)" : "none", transition: "all 0.35s ease", padding: "0 clamp(1rem,4vw,3rem)", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("Accueil")}>
        <span style={{ fontSize: 26 }}>⛩️</span>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: "#ff4e4e", letterSpacing: 2 }}>ANIMÛ</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="desktop-nav">
        {links.map((l) => (
          <button key={l} onClick={() => setPage(l)} style={{ background: "none", border: "none", cursor: "pointer", color: page === l ? "#ff4e4e" : "#ccc", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 1, padding: "6px 14px", borderRadius: 6, borderBottom: page === l ? "2px solid #ff4e4e" : "2px solid transparent", transition: "all 0.2s" }}>{l}</button>
        ))}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 13 }}>👤 {user.email.split("@")[0]}</span>
            <button onClick={onSignOut} style={{ background: "rgba(255,78,78,0.1)", border: "1px solid rgba(255,78,78,0.3)", color: "#ff4e4e", cursor: "pointer", padding: "6px 14px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}>Déconnexion</button>
          </div>
        ) : (
          <button onClick={onAuthClick} style={{ background: "#ff4e4e", border: "none", color: "#fff", cursor: "pointer", padding: "7px 18px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700 }}>Connexion</button>
        )}
      </div>
      <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 24, display: "none" }} className="hamburger">☰</button>
      {menuOpen && (
        <div style={{ position: "absolute", top: 64, left: 0, right: 0, background: "rgba(10,10,20,0.98)", padding: "1rem", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map((l) => (
            <button key={l} onClick={() => { setPage(l); setMenuOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: page === l ? "#ff4e4e" : "#ccc", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, padding: "12px 16px", textAlign: "left", borderRadius: 6 }}>{l}</button>
          ))}
          {user
            ? <button onClick={onSignOut} style={{ background: "none", border: "none", color: "#ff4e4e", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14, padding: "12px 16px", textAlign: "left" }}>Déconnexion</button>
            : <button onClick={() => { onAuthClick(); setMenuOpen(false); }} style={{ background: "#ff4e4e", border: "none", color: "#fff", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, padding: "10px 16px", borderRadius: 20, margin: "4px 16px" }}>Connexion</button>
          }
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Outfit:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');
        @media(max-width:640px){ .desktop-nav{display:none!important} .hamburger{display:block!important} }
      `}</style>
    </nav>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function HeroSection({ setPage }) {
  const videoRef = useRef();
  return (
    <section style={{ position: "relative", height: "100vh", minHeight: 500, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video ref={videoRef} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) saturate(1.4)" }} src={HERO_VIDEO} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,5,15,0.2) 0%, rgba(5,5,15,0.85) 100%)" }} />
      <div style={{ position: "relative", textAlign: "center", padding: "0 1.5rem", maxWidth: 700 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", letterSpacing: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>✦ Le blog anime #1 ✦</p>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(2.2rem,6vw,4.5rem)", color: "#fff", lineHeight: 1.15, marginBottom: 20, textShadow: "0 0 40px rgba(255,78,78,0.5)" }}>
          Plonge dans<br /><span style={{ color: "#ff4e4e" }}>l'univers anime</span>
        </h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: "clamp(0.95rem,2vw,1.15rem)", lineHeight: 1.7, marginBottom: 32 }}>Reviews, analyses et news sur les meilleures séries animées.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("Blog")} style={{ background: "#ff4e4e", color: "#fff", border: "none", cursor: "pointer", padding: "14px 32px", borderRadius: 30, fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1, boxShadow: "0 0 20px rgba(255,78,78,0.4)", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}>Lire les articles →</button>
          <button onClick={() => setPage("Contribuer")} style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)", cursor: "pointer", padding: "14px 32px", borderRadius: 30, fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 1, transition: "border-color 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor = "#ff4e4e"} onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"}>Soumettre un article</button>
        </div>
      </div>
    </section>
  );
}

// ── MODAL COMMENTAIRES ────────────────────────────────────────────────────────
function CommentsModal({ post, onClose, user, onAuthClick }) {
  const { comments, loading, addComment } = useComments(post.id);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!user) { onClose(); onAuthClick(); return; }
    if (!content.trim()) { setError("Écris un commentaire."); return; }
    setSending(true);
    const ok = await addComment(post.id, user.email.split("@")[0], content.trim());
    if (ok) { setContent(""); setError(""); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#111122", border: "1px solid rgba(255,78,78,0.2)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0 }}>COMMENTAIRES</p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: "1rem", margin: "4px 0 0" }}>{post.title}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <p style={{ color: "#555", fontFamily: "'Outfit', sans-serif", textAlign: "center", padding: "2rem 0" }}>Chargement...</p>}
          {!loading && comments.length === 0 && <p style={{ color: "#444", fontFamily: "'Outfit', sans-serif", textAlign: "center", padding: "2rem 0" }}>Aucun commentaire. Sois le premier ! 👇</p>}
          {comments.map((c) => (
            <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", color: "#444", fontSize: 11 }}>{new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#bbb", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{c.content}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 10 }}>
          {!user && <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff8c42", fontSize: 13, margin: 0 }}>🔒 Connecte-toi pour commenter</p>}
          {error && <p style={{ color: "#ff4e4e", fontFamily: "'Outfit', sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
          <textarea value={content} onChange={e => { setContent(e.target.value); setError(""); }} placeholder={user ? "Ton commentaire..." : "Connecte-toi pour commenter"} rows={3} disabled={!user}
            style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 8, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", resize: "none", opacity: user ? 1 : 0.5 }} />
          <button onClick={handleSend} disabled={sending} style={{ background: user ? "linear-gradient(135deg,#ff4e4e,#ff8c42)" : "#333", border: "none", color: "#fff", cursor: "pointer", padding: "10px 20px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, opacity: sending ? 0.6 : 1, alignSelf: "flex-end" }}>
            {!user ? "Se connecter →" : sending ? "Envoi..." : "Publier ✦"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── POST CARD ─────────────────────────────────────────────────────────────────
function PostCard({ post, onLike, user, onAuthClick, likedPosts }) {
  const [hovered, setHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeMsg, setLikeMsg] = useState("");
  const catColor = post.category === "Review" ? "#ff4e4e" : post.category === "Analyse" ? "#4e9eff" : "#4eff9e";
  const likeCount = post.likes?.[0]?.count ?? 0;
  const commentCount = post.comments?.[0]?.count ?? 0;
  const alreadyLiked = likedPosts?.has(post.id);

  const handleLike = async () => {
    const result = await onLike(post.id);
    if (result === "login") { setLikeMsg("🔒 Connecte-toi pour liker !"); setTimeout(() => setLikeMsg(""), 2500); }
    else if (result === "already") { setLikeMsg("Tu as déjà liké cet article !"); setTimeout(() => setLikeMsg(""), 2500); }
  };

  return (
    <>
      {showComments && <CommentsModal post={post} onClose={() => setShowComments(false)} user={user} onAuthClick={onAuthClick} />}
      <article onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ borderRadius: 16, overflow: "hidden", background: "#111122", border: "1px solid rgba(255,255,255,0.07)", boxShadow: hovered ? "0 12px 40px rgba(255,78,78,0.2)" : "0 4px 20px rgba(0,0,0,0.4)", transform: hovered ? "translateY(-4px)" : "none", transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", overflow: "hidden", height: 200 }}>
          <img src={post.cover} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", transform: hovered ? "scale(1.07)" : "scale(1)", transition: "transform 0.5s ease" }} />
          <span style={{ position: "absolute", top: 12, left: 12, background: catColor, color: "#000", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: 20, letterSpacing: 1, textTransform: "uppercase" }}>{post.category}</span>
        </div>
        <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#555", fontSize: 12, margin: 0 }}>
            {new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · par <span style={{ color: "#ff4e4e" }}>{post.author}</span>
          </p>
          <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: "1.1rem", lineHeight: 1.4, margin: 0 }}>{post.title}</h3>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14, lineHeight: 1.6, flex: 1, margin: 0 }}>{post.excerpt}</p>
          {likeMsg && <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff8c42", fontSize: 12, margin: 0 }}>{likeMsg}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button onClick={handleLike} style={{ background: alreadyLiked ? "rgba(255,78,78,0.25)" : "rgba(255,78,78,0.1)", border: "1px solid rgba(255,78,78,0.3)", color: "#ff4e4e", cursor: "pointer", padding: "6px 14px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, transition: "background 0.2s" }}>
              {alreadyLiked ? "♥" : "♡"} {likeCount}
            </button>
            <button onClick={() => setShowComments(true)} style={{ background: "rgba(78,158,255,0.1)", border: "1px solid rgba(78,158,255,0.3)", color: "#4e9eff", cursor: "pointer", padding: "6px 14px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}>
              💬 {commentCount}
            </button>
          </div>
        </div>
      </article>
    </>
  );
}

// ── BLOG PAGE ─────────────────────────────────────────────────────────────────
function BlogPage({ posts, loading, onLike, user, onAuthClick, likedPosts }) {
  const { filtered, category, setCategory, search, setSearch } = useFilter(posts);
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}><p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 16, letterSpacing: 2 }}>Chargement...</p></div>;
  return (
    <main style={{ padding: "100px clamp(1rem,5vw,4rem) 4rem", maxWidth: 1300, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.6rem,3vw,2.4rem)", marginBottom: 8 }}>Tous les articles</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#666", marginBottom: 32 }}>Reviews, analyses et dernières news du monde anime.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{ background: category === c ? "#ff4e4e" : "transparent", border: "1.5px solid " + (category === c ? "#ff4e4e" : "rgba(255,255,255,0.15)"), color: category === c ? "#fff" : "#888", padding: "7px 18px", borderRadius: 20, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>{c}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#fff", padding: "7px 16px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", minWidth: 180 }} />
      </div>
      {filtered.length === 0
        ? <p style={{ fontFamily: "'Outfit', sans-serif", color: "#555", textAlign: "center", padding: "3rem 0" }}>Aucun article trouvé.</p>
        : <>
            <style>{`.grid-posts{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem}@media(max-width:1024px){.grid-posts{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.grid-posts{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.grid-posts{grid-template-columns:1fr}}`}</style>
            <div className="grid-posts">{filtered.map((p) => <PostCard key={p.id} post={p} onLike={onLike} user={user} onAuthClick={onAuthClick} likedPosts={likedPosts} />)}</div>
          </>
      }
    </main>
  );
}

// ── ABOUT PAGE ────────────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <main style={{ padding: "110px clamp(1rem,5vw,4rem) 4rem", maxWidth: 760, margin: "0 auto" }}>
      <span style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", letterSpacing: 3, fontSize: 11, fontWeight: 700 }}>⛩️ À PROPOS</span>
      <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "12px 0 24px" }}>Qui sommes-nous ?</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", lineHeight: 1.9, fontSize: 16, marginBottom: 20 }}><strong style={{ color: "#fff" }}>ANIMÛ</strong> est un blog indépendant créé par des passionnés pour des passionnés. Notre équipe couvre l'actualité anime — nouvelles saisons, critiques approfondies, analyses culturelles.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 32 }}>
        {[["📝", "Articles publiés", "80+"], ["❤️", "Lecteurs mensuels", "12K"], ["🎌", "Animes couverts", "200+"]].map(([icon, label, val]) => (
          <div key={label} style={{ flex: "1 1 160px", background: "#111122", border: "1px solid rgba(255,78,78,0.15)", borderRadius: 12, padding: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>{icon}</div>
            <div style={{ fontFamily: "'Cinzel', serif", color: "#ff4e4e", fontSize: 22, marginTop: 8 }}>{val}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", color: "#666", fontSize: 13 }}>{label}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ── CONTRIBUER PAGE ───────────────────────────────────────────────────────────
function ContribuerPage({ onAddPost, user, onAuthClick }) {
  const [form, setForm] = useState({ title: "", category: "Review", excerpt: "", author: "", cover: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Le titre est requis.";
    if (!form.excerpt.trim()) e.excerpt = "Le résumé est requis.";
    if (!form.author.trim()) e.author = "Le pseudo est requis.";
    return e;
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

 const sendEmail = async (formData) => {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${import.meta.env.VITE_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ANIMÛ <onboarding@resend.dev>",
      to: "xfausthernze@gmail.com",
      subject: `Nouvel article : ${formData.title}`,
      html: `...`, // Resend utilise le template ID directement
    }),
  });
};
  const handleSubmit = async () => {
    if (!user) { onAuthClick(); return; }
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSending(true);
    const postData = { title: form.title, category: form.category, excerpt: form.excerpt, author: form.author, cover: form.cover || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80" };
    await onAddPost(postData);
    await sendEmail(postData);
    setSent(true); setSending(false);
    setForm({ title: "", category: "Review", excerpt: "", author: "", cover: "" });
    setTimeout(() => setSent(false), 4000);
  };

  const fieldStyle = (err) => ({ ...baseInput, border: `1.5px solid ${err ? "#ff4e4e" : "rgba(255,255,255,0.12)"}` });

  return (
    <main style={{ padding: "110px clamp(1rem,5vw,4rem) 4rem", maxWidth: 640, margin: "0 auto" }}>
      <span style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", letterSpacing: 3, fontSize: 11, fontWeight: 700 }}>✦ CONTRIBUER</span>
      <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.8rem,4vw,2.6rem)", margin: "12px 0 8px" }}>Soumettre un article</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#666", marginBottom: 32 }}>Tu veux partager ta passion ? Remplis le formulaire ci-dessous.</p>

      {!user && (
        <div style={{ background: "rgba(255,78,78,0.08)", border: "1px solid rgba(255,78,78,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ccc", fontSize: 14, margin: 0 }}>🔒 Tu dois être connecté pour soumettre un article.</p>
          <button onClick={onAuthClick} style={{ background: "#ff4e4e", border: "none", color: "#fff", cursor: "pointer", padding: "8px 20px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700 }}>Se connecter</button>
        </div>
      )}

      {sent && <div style={{ background: "rgba(78,255,158,0.1)", border: "1px solid #4eff9e", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontFamily: "'Outfit', sans-serif", color: "#4eff9e", fontSize: 14 }}>✅ Article soumis ! Une notification t'a été envoyée par email.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20, opacity: user ? 1 : 0.4, pointerEvents: user ? "auto" : "none" }}>
        <div>
          <label style={labelStyle}>Titre *</label>
          <input value={form.title} onChange={handleChange("title")} placeholder="ex: Jujutsu Kaisen — L'arc Shibuya" style={fieldStyle(errors.title)} />
          {errors.title && <p style={errorStyle}>{errors.title}</p>}
        </div>
        <div>
          <label style={labelStyle}>Catégorie</label>
          <select value={form.category} onChange={handleChange("category")} style={{ ...fieldStyle(false), cursor: "pointer" }}>
            {["Review", "Analyse", "News"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Résumé *</label>
          <textarea value={form.excerpt} onChange={handleChange("excerpt")} rows={4} placeholder="Donne envie aux lecteurs..." style={{ ...fieldStyle(errors.excerpt), resize: "vertical" }} />
          {errors.excerpt && <p style={errorStyle}>{errors.excerpt}</p>}
        </div>
        <div>
          <label style={labelStyle}>Pseudo *</label>
          <input value={form.author} onChange={handleChange("author")} placeholder="ex: OtakuSama" style={fieldStyle(errors.author)} />
          {errors.author && <p style={errorStyle}>{errors.author}</p>}
        </div>

        <div>
          <label style={labelStyle}>URL image de couverture (optionnel)</label>
          <input value={form.cover} onChange={handleChange("cover")} placeholder="https://..." style={fieldStyle(false)} />
        </div>
        <button onClick={handleSubmit} disabled={sending} style={{ background: "linear-gradient(135deg,#ff4e4e,#ff8c42)", border: "none", color: "#fff", cursor: sending ? "not-allowed" : "pointer", padding: "14px 28px", borderRadius: 30, fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, boxShadow: "0 4px 20px rgba(255,78,78,0.35)", opacity: sending ? 0.7 : 1, alignSelf: "flex-start" }}>
          {sending ? "Envoi en cours..." : "Publier mon article →"}
        </button>
      </div>
    </main>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer({ setPage }) {
  return (
    <footer style={{ background: "#08080f", borderTop: "1px solid rgba(255,78,78,0.1)", padding: "2.5rem clamp(1rem,5vw,4rem)", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>⛩️</span>
        <span style={{ fontFamily: "'Cinzel', serif", color: "#ff4e4e", fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>ANIMÛ</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", color: "#333", fontSize: 13, marginLeft: 8 }}>© 2026</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["Accueil", "Blog", "À propos", "Contribuer"].map((l) => (
          <button key={l} onClick={() => setPage(l)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 13, padding: "4px 8px" }}>{l}</button>
        ))}
      </div>
    </footer>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("Accueil");
  const [showAuth, setShowAuth] = useState(false);
  const { user, loadingAuth, signIn, signUp, signOut } = useAuth();
  const { posts, loading, addPost, toggleLike, likedPosts } = usePosts(user?.id);

  if (loadingAuth) return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#ff4e4e", fontFamily: "'Outfit', sans-serif", letterSpacing: 2 }}>Chargement...</p>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "Accueil": return (
        <>
          <HeroSection setPage={setPage} />
          <section style={{ padding: "4rem clamp(1rem,5vw,4rem)", maxWidth: 1300, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.3rem,2.5vw,1.8rem)", margin: 0 }}>Articles récents</h2>
              <button onClick={() => setPage("Blog")} style={{ background: "transparent", border: "1.5px solid rgba(255,78,78,0.4)", color: "#ff4e4e", cursor: "pointer", padding: "8px 20px", borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}>Voir tout →</button>
            </div>
            {loading
              ? <p style={{ color: "#555", fontFamily: "'Outfit', sans-serif" }}>Chargement...</p>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1.4rem" }}>
                  {posts.slice(0, 4).map((p) => <PostCard key={p.id} post={p} onLike={toggleLike} user={user} onAuthClick={() => setShowAuth(true)} likedPosts={likedPosts} />)}
                </div>
            }
          </section>
        </>
      );
      case "Blog": return <BlogPage posts={posts} loading={loading} onLike={toggleLike} user={user} onAuthClick={() => setShowAuth(true)} likedPosts={likedPosts} />;
      case "À propos": return <AboutPage />;
      case "Contribuer": return <ContribuerPage onAddPost={addPost} user={user} onAuthClick={() => setShowAuth(true)} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff" }}>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} signIn={signIn} signUp={signUp} />}
      <Navbar page={page} setPage={setPage} user={user} onAuthClick={() => setShowAuth(true)} onSignOut={signOut} />
      {renderPage()}
      <Footer setPage={setPage} />
    </div>
  );
}
