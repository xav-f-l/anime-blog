import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Tous", "Review", "Analyse", "News"];
const HERO_VIDEO = "gojo.mp4";

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function usePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPosts(); }, []);

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
      .from("posts")
      .insert([post])
      .select("*, likes(count), comments(count)")
      .single();
    if (!error && data) setPosts((prev) => [data, ...prev]);
  };

  const toggleLike = async (postId) => {
    await supabase.from("likes").insert([{ post_id: postId }]);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: [{ count: (p.likes?.[0]?.count || 0) + 1 }] }
          : p
      )
    );
  };

  return { posts, loading, addPost, toggleLike, refetch: fetchPosts };
}

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

function useComments(postId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setComments(data || []); setLoading(false); });
  }, [postId]);

  const addComment = async (postId, author, content) => {
    const { data, error } = await supabase
      .from("comments")
      .insert([{ post_id: postId, author, content }])
      .select()
      .single();
    if (!error && data) setComments((prev) => [...prev, data]);
    return !error;
  };

  return { comments, loading, addComment };
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = ["Accueil", "Blog", "À propos", "Contribuer"];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? "rgba(10,10,20,0.95)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,80,80,0.15)" : "none",
      transition: "all 0.35s ease",
      padding: "0 clamp(1rem,4vw,3rem)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 64,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("Accueil")}>
        <span style={{ fontSize: 26 }}>⛩️</span>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: "#ff4e4e", letterSpacing: 2 }}>ANIMÛ</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="desktop-nav">
        {links.map((l) => (
          <button key={l} onClick={() => setPage(l)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: page === l ? "#ff4e4e" : "#ccc",
            fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600,
            letterSpacing: 1, padding: "6px 14px", borderRadius: 6,
            borderBottom: page === l ? "2px solid #ff4e4e" : "2px solid transparent",
            transition: "all 0.2s",
          }}>{l}</button>
        ))}
      </div>

      <button onClick={() => setMenuOpen(!menuOpen)} style={{
        background: "none", border: "none", cursor: "pointer", color: "#fff",
        fontSize: 24, display: "none",
      }} className="hamburger">☰</button>

      {menuOpen && (
        <div style={{
          position: "absolute", top: 64, left: 0, right: 0,
          background: "rgba(10,10,20,0.98)", padding: "1rem",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {links.map((l) => (
            <button key={l} onClick={() => { setPage(l); setMenuOpen(false); }} style={{
              background: "none", border: "none", cursor: "pointer",
              color: page === l ? "#ff4e4e" : "#ccc",
              fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600,
              padding: "12px 16px", textAlign: "left", borderRadius: 6,
            }}>{l}</button>
          ))}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Outfit:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');
        @media(max-width:640px){ .desktop-nav{display:none!important} .hamburger{display:block!important} }
      `}</style>
    </nav>
  );
}

function HeroSection({ setPage }) {
  const videoRef = useRef();
  return (
    <section style={{ position: "relative", height: "100vh", minHeight: 500, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video ref={videoRef} autoPlay muted loop playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) saturate(1.4)" }}
        src={HERO_VIDEO} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(5,5,15,0.2) 0%, rgba(5,5,15,0.85) 100%)" }} />
      <div style={{ position: "relative", textAlign: "center", padding: "0 1.5rem", maxWidth: 700 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", letterSpacing: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>✦ Le blog anime #1 ✦</p>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(2.2rem,6vw,4.5rem)", color: "#fff", lineHeight: 1.15, marginBottom: 20, textShadow: "0 0 40px rgba(255,78,78,0.5)" }}>
          Plonge dans<br /><span style={{ color: "#ff4e4e" }}>l'univers anime</span>
        </h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", fontSize: "clamp(0.95rem,2vw,1.15rem)", lineHeight: 1.7, marginBottom: 32 }}>
          Reviews, analyses et news sur les meilleures séries animées. Passionné(e) d'anime ? Tu es au bon endroit.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("Blog")} style={{
            background: "#ff4e4e", color: "#fff", border: "none", cursor: "pointer",
            padding: "14px 32px", borderRadius: 30, fontFamily: "'Outfit', sans-serif",
            fontSize: 15, fontWeight: 700, letterSpacing: 1,
            boxShadow: "0 0 20px rgba(255,78,78,0.4)", transition: "transform 0.2s",
          }} onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}>
            Lire les articles →
          </button>
          <button onClick={() => setPage("Contribuer")} style={{
            background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)", cursor: "pointer",
            padding: "14px 32px", borderRadius: 30, fontFamily: "'Outfit', sans-serif",
            fontSize: 15, fontWeight: 600, letterSpacing: 1, transition: "border-color 0.2s",
          }} onMouseOver={e => e.currentTarget.style.borderColor = "#ff4e4e"} onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"}>
            Soumettre un article
          </button>
        </div>
      </div>
    </section>
  );
}

// ── MODAL COMMENTAIRES ────────────────────────────────────────────────────────
function CommentsModal({ post, onClose }) {
  const { comments, loading, addComment } = useComments(post.id);
  const [form, setForm] = useState({ author: "", content: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!form.author.trim() || !form.content.trim()) { setError("Remplis tous les champs."); return; }
    setSending(true);
    const ok = await addComment(post.id, form.author.trim(), form.content.trim());
    if (ok) { setForm({ author: "", content: "" }); setError(""); }
    setSending(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }} onClick={onClose}>
      <div style={{
        background: "#111122", border: "1px solid rgba(255,78,78,0.2)",
        borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0 }}>COMMENTAIRES</p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: "1rem", margin: "4px 0 0" }}>{post.title}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Liste commentaires */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <p style={{ color: "#555", fontFamily: "'Outfit', sans-serif", textAlign: "center", padding: "2rem 0" }}>Chargement...</p>}
          {!loading && comments.length === 0 && (
            <p style={{ color: "#444", fontFamily: "'Outfit', sans-serif", textAlign: "center", padding: "2rem 0" }}>Aucun commentaire pour l'instant. Sois le premier ! 👇</p>
          )}
          {comments.map((c) => (
            <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", color: "#444", fontSize: 11 }}>
                  {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p style={{ fontFamily: "'Outfit', sans-serif", color: "#bbb", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{c.content}</p>
            </div>
          ))}
        </div>

        {/* Formulaire ajout */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <p style={{ color: "#ff4e4e", fontFamily: "'Outfit', sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
          <input
            value={form.author} onChange={e => { setForm(p => ({ ...p, author: e.target.value })); setError(""); }}
            placeholder="Ton pseudo"
            style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 8, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none" }}
          />
          <textarea
            value={form.content} onChange={e => { setForm(p => ({ ...p, content: e.target.value })); setError(""); }}
            placeholder="Ton commentaire..." rows={3}
            style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 8, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none", resize: "none" }}
          />
          <button onClick={handleSend} disabled={sending} style={{
            background: "linear-gradient(135deg,#ff4e4e,#ff8c42)", border: "none", color: "#fff",
            cursor: sending ? "not-allowed" : "pointer", padding: "10px 20px", borderRadius: 20,
            fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, opacity: sending ? 0.6 : 1,
            alignSelf: "flex-end",
          }}>
            {sending ? "Envoi..." : "Publier ✦"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── POST CARD ─────────────────────────────────────────────────────────────────
function PostCard({ post, onLike }) {
  const [hovered, setHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const catColor = post.category === "Review" ? "#ff4e4e" : post.category === "Analyse" ? "#4e9eff" : "#4eff9e";
  const likeCount = post.likes?.[0]?.count ?? post.likes ?? 0;
  const commentCount = post.comments?.[0]?.count ?? 0;

  return (
    <>
      {showComments && <CommentsModal post={post} onClose={() => setShowComments(false)} />}
      <article
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: 16, overflow: "hidden", background: "#111122",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: hovered ? "0 12px 40px rgba(255,78,78,0.2)" : "0 4px 20px rgba(0,0,0,0.4)",
          transform: hovered ? "translateY(-4px)" : "none",
          transition: "all 0.3s ease",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ position: "relative", overflow: "hidden", height: 200 }}>
          <img src={post.cover} alt={post.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: hovered ? "scale(1.07)" : "scale(1)", transition: "transform 0.5s ease" }} />
          <span style={{
            position: "absolute", top: 12, left: 12,
            background: catColor, color: "#000",
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11,
            padding: "4px 10px", borderRadius: 20, letterSpacing: 1, textTransform: "uppercase",
          }}>{post.category}</span>
        </div>
        <div style={{ padding: "1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#555", fontSize: 12, margin: 0 }}>
            {post.date || new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · par <span style={{ color: "#ff4e4e" }}>{post.author}</span>
          </p>
          <h3 style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: "1.1rem", lineHeight: 1.4, margin: 0 }}>{post.title}</h3>
          <p style={{ fontFamily: "'Outfit', sans-serif", color: "#888", fontSize: 14, lineHeight: 1.6, flex: 1, margin: 0 }}>{post.excerpt}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            {/* Like */}
            <button onClick={() => onLike(post.id)} style={{
              background: "rgba(255,78,78,0.1)", border: "1px solid rgba(255,78,78,0.3)",
              color: "#ff4e4e", cursor: "pointer", padding: "6px 14px",
              borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600,
              transition: "background 0.2s",
            }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,78,78,0.25)"} onMouseOut={e => e.currentTarget.style.background = "rgba(255,78,78,0.1)"}>
              ♥ {likeCount}
            </button>
            {/* Commentaires */}
            <button onClick={() => setShowComments(true)} style={{
              background: "rgba(78,158,255,0.1)", border: "1px solid rgba(78,158,255,0.3)",
              color: "#4e9eff", cursor: "pointer", padding: "6px 14px",
              borderRadius: 20, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600,
              transition: "background 0.2s",
            }} onMouseOver={e => e.currentTarget.style.background = "rgba(78,158,255,0.25)"} onMouseOut={e => e.currentTarget.style.background = "rgba(78,158,255,0.1)"}>
              💬 {commentCount}
            </button>
          </div>
        </div>
      </article>
    </>
  );
}

// ── BLOG PAGE ─────────────────────────────────────────────────────────────────
function BlogPage({ posts, loading, onLike }) {
  const { filtered, category, setCategory, search, setSearch } = useFilter(posts);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 16, letterSpacing: 2 }}>Chargement des articles...</p>
    </div>
  );

  return (
    <main style={{ padding: "100px clamp(1rem,5vw,4rem) 4rem", maxWidth: 1300, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.6rem,3vw,2.4rem)", marginBottom: 8 }}>Tous les articles</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#666", marginBottom: 32 }}>Reviews, analyses et dernières news du monde anime.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{
            background: category === c ? "#ff4e4e" : "transparent",
            border: "1.5px solid " + (category === c ? "#ff4e4e" : "rgba(255,255,255,0.15)"),
            color: category === c ? "#fff" : "#888",
            padding: "7px 18px", borderRadius: 20, cursor: "pointer",
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
            transition: "all 0.2s",
          }}>{c}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher..."
          style={{
            background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)",
            color: "#fff", padding: "7px 16px", borderRadius: 20,
            fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", minWidth: 180,
          }} />
      </div>

      {filtered.length === 0
        ? <p style={{ fontFamily: "'Outfit', sans-serif", color: "#555", textAlign: "center", padding: "3rem 0" }}>Aucun article trouvé.</p>
        : <>
            <style>{`
              .grid-posts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
              @media(max-width: 1024px){ .grid-posts { grid-template-columns: repeat(3, 1fr); } }
              @media(max-width: 700px){ .grid-posts { grid-template-columns: repeat(2, 1fr); } }
              @media(max-width: 480px){ .grid-posts { grid-template-columns: 1fr; } }
            `}</style>
            <div className="grid-posts">
              {filtered.map((p) => <PostCard key={p.id} post={p} onLike={onLike} />)}
            </div>
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
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", lineHeight: 1.9, fontSize: 16, marginBottom: 20 }}>
        <strong style={{ color: "#fff" }}>ANIMÛ</strong> est un blog indépendant créé par des passionnés pour des passionnés. Notre équipe de rédacteurs couvre l'actualité anime — nouvelles saisons, critiques approfondies, analyses culturelles.
      </p>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#aaa", lineHeight: 1.9, fontSize: 16 }}>
        Nous croyons que l'animation japonaise est un art à part entière, capable de transmettre des émotions et des réflexions que peu de médias peuvent égaler.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 32 }}>
        {[["📝", "Articles publiés", "80+"], ["❤️", "Lecteurs mensuels", "12K"], ["🎌", "Animes couverts", "200+"]].map(([icon, label, val]) => (
          <div key={label} style={{
            flex: "1 1 160px", background: "#111122", border: "1px solid rgba(255,78,78,0.15)",
            borderRadius: 12, padding: "1.5rem", textAlign: "center",
          }}>
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
const labelStyle = { fontFamily: "'Outfit', sans-serif", color: "#ccc", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8, letterSpacing: 0.5 };
const errorStyle = { fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", fontSize: 12, marginTop: 6 };

function ContribuerPage({ onAddPost }) {
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

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSending(true);
    await onAddPost({
      title: form.title,
      category: form.category,
      excerpt: form.excerpt,
      author: form.author,
      cover: form.cover || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80",
    });
    setSent(true);
    setSending(false);
    setForm({ title: "", category: "Review", excerpt: "", author: "", cover: "" });
    setTimeout(() => setSent(false), 4000);
  };

  const fieldStyle = (err) => ({
    width: "100%", background: "rgba(255,255,255,0.04)", color: "#fff",
    border: `1.5px solid ${err ? "#ff4e4e" : "rgba(255,255,255,0.12)"}`,
    borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 15,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
  });

  return (
    <main style={{ padding: "110px clamp(1rem,5vw,4rem) 4rem", maxWidth: 640, margin: "0 auto" }}>
      <span style={{ fontFamily: "'Outfit', sans-serif", color: "#ff4e4e", letterSpacing: 3, fontSize: 11, fontWeight: 700 }}>✦ CONTRIBUER</span>
      <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.8rem,4vw,2.6rem)", margin: "12px 0 8px" }}>Soumettre un article</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", color: "#666", marginBottom: 32 }}>Tu veux partager ta passion ? Remplis le formulaire ci-dessous.</p>

      {sent && (
        <div style={{
          background: "rgba(78,255,158,0.1)", border: "1px solid #4eff9e",
          borderRadius: 10, padding: "14px 18px", marginBottom: 24,
          fontFamily: "'Outfit', sans-serif", color: "#4eff9e", fontSize: 14,
        }}>✅ Article soumis et publié dans le blog !</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={labelStyle}>Titre de l'article *</label>
          <input value={form.title} onChange={handleChange("title")} placeholder="ex: Jujutsu Kaisen — Analyse de l'arc Shibuya" style={fieldStyle(errors.title)} />
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
          <textarea value={form.excerpt} onChange={handleChange("excerpt")} rows={4}
            placeholder="Donne envie aux lecteurs de découvrir ton article..."
            style={{ ...fieldStyle(errors.excerpt), resize: "vertical" }} />
          {errors.excerpt && <p style={errorStyle}>{errors.excerpt}</p>}
        </div>
        <div>
          <label style={labelStyle}>Ton pseudo *</label>
          <input value={form.author} onChange={handleChange("author")} placeholder="ex: OtakuSama" style={fieldStyle(errors.author)} />
          {errors.author && <p style={errorStyle}>{errors.author}</p>}
        </div>
        <div>
          <label style={labelStyle}>URL de l'image de couverture (optionnel)</label>
          <input value={form.cover} onChange={handleChange("cover")} placeholder="https://..." style={fieldStyle(false)} />
        </div>
        <button onClick={handleSubmit} disabled={sending} style={{
          background: "linear-gradient(135deg,#ff4e4e,#ff8c42)",
          border: "none", color: "#fff", cursor: sending ? "not-allowed" : "pointer",
          padding: "14px 28px", borderRadius: 30, fontFamily: "'Outfit', sans-serif",
          fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
          boxShadow: "0 4px 20px rgba(255,78,78,0.35)",
          opacity: sending ? 0.7 : 1, transition: "opacity 0.2s",
          alignSelf: "flex-start",
        }}>
          {sending ? "Publication en cours..." : "Publier mon article →"}
        </button>
      </div>
    </main>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer({ setPage }) {
  return (
    <footer style={{
      background: "#08080f", borderTop: "1px solid rgba(255,78,78,0.1)",
      padding: "2.5rem clamp(1rem,5vw,4rem)", display: "flex",
      flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>⛩️</span>
        <span style={{ fontFamily: "'Cinzel', serif", color: "#ff4e4e", fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>ANIMÛ</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", color: "#333", fontSize: 13, marginLeft: 8 }}>© 2026</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["Accueil", "Blog", "À propos", "Contribuer"].map((l) => (
          <button key={l} onClick={() => setPage(l)} style={{
            background: "none", border: "none", color: "#555", cursor: "pointer",
            fontFamily: "'Outfit', sans-serif", fontSize: 13, padding: "4px 8px",
          }}>{l}</button>
        ))}
      </div>
    </footer>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("Accueil");
  const { posts, loading, addPost, toggleLike } = usePosts();

  const renderPage = () => {
    switch (page) {
      case "Accueil": return (
        <>
          <HeroSection setPage={setPage} />
          <section style={{ padding: "4rem clamp(1rem,5vw,4rem)", maxWidth: 1300, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", color: "#fff", fontSize: "clamp(1.3rem,2.5vw,1.8rem)", margin: 0 }}>Articles récents</h2>
              <button onClick={() => setPage("Blog")} style={{
                background: "transparent", border: "1.5px solid rgba(255,78,78,0.4)",
                color: "#ff4e4e", cursor: "pointer", padding: "8px 20px", borderRadius: 20,
                fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600,
              }}>Voir tout →</button>
            </div>
            {loading
              ? <p style={{ color: "#555", fontFamily: "'Outfit', sans-serif" }}>Chargement...</p>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1.4rem" }}>
                  {posts.slice(0, 4).map((p) => <PostCard key={p.id} post={p} onLike={toggleLike} />)}
                </div>
            }
          </section>
        </>
      );
      case "Blog": return <BlogPage posts={posts} loading={loading} onLike={toggleLike} />;
      case "À propos": return <AboutPage />;
      case "Contribuer": return <ContribuerPage onAddPost={addPost} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff" }}>
      <Navbar page={page} setPage={setPage} />
      {renderPage()}
      <Footer setPage={setPage} />
    </div>
  );
}
