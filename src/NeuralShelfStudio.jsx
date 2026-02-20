import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ── Storage (localStorage — works in any browser, any host) ──
const STORAGE_KEY = "neural-shelf-v2";

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    console.error("Save failed", e);
  }
}

// ── Constants ──
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const COLORS = [
  "#FF6B6B","#FF8C42","#F9C74F","#6BCB77","#4D96FF",
  "#9B5DE5","#FF6B9D","#48CAE4","#F4845F","#90BE6D",
  "#C77DFF","#FFD93D"
];

function deweyColor(dewey) {
  const d = String(dewey || "").trim()[0];
  const map = {
    '0':'#4D96FF','1':'#9B5DE5','2':'#F4845F','3':'#FF6B9D',
    '4':'#48CAE4','5':'#6BCB77','6':'#FF8C42','7':'#FFD93D',
    '8':'#FF6B6B','9':'#90BE6D'
  };
  return map[d] || '#A09890';
}

function wordColor(word) {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

// ── Main Component ──
export default function NeuralShelfStudio() {
  const [books, setBooks]               = useState(() => loadBooks());
  const [view, setView]                 = useState("library");
  const [activeBookId, setActiveBookId] = useState(null);
  const [activeLetter, setActiveLetter] = useState(null);
  const [wordInput, setWordInput]       = useState("");
  const [searchQuery, setSearchQuery]   = useState("");
  const [newTitle, setNewTitle]         = useState("");
  const [newAuthor, setNewAuthor]       = useState("");
  const [newDewey, setNewDewey]         = useState("");
  const [newTags, setNewTags]           = useState("");
  const [editingNote, setEditingNote]   = useState(false);
  const [noteInput, setNoteInput]       = useState("");
  const [imgRange, setImgRange]         = useState("");
  const [imgNote, setImgNote]           = useState("");
  const fileRef = useRef(null);

  // Save on every books change
  useEffect(() => {
    saveBooks(books);
  }, [books]);

  const activeBook = books.find(b => b.id === activeBookId) || null;

  // ── Actions ──
  function addBook() {
    if (!newTitle.trim()) return;
    const book = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      author: newAuthor.trim(),
      dewey: newDewey.trim(),
      tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
      sessionNote: "",
      created: new Date().toISOString(),
      letters: {},
      images: [],
    };
    setBooks(prev => [book, ...prev]);
    setNewTitle(""); setNewAuthor(""); setNewDewey(""); setNewTags("");
    setActiveBookId(book.id); setView("book"); setActiveLetter(null); setEditingNote(false);
  }

  function toggleLetter(letter) {
    setActiveLetter(prev => prev === letter ? null : letter);
    setWordInput("");
  }

  function addWord() {
    if (!activeBook || !activeLetter || !wordInput.trim()) return;
    setBooks(prev => prev.map(b => {
      if (b.id !== activeBookId) return b;
      const letters = { ...b.letters };
      if (!letters[activeLetter]) letters[activeLetter] = { words: [] };
      const words = [...letters[activeLetter].words];
      wordInput.split(",").forEach(w => {
        const t = w.trim().toLowerCase();
        if (t && !words.includes(t)) words.push(t);
      });
      letters[activeLetter] = { ...letters[activeLetter], words };
      return { ...b, letters };
    }));
    setWordInput("");
  }

  function removeWord(letter, word) {
    setBooks(prev => prev.map(b => {
      if (b.id !== activeBookId) return b;
      const letters = { ...b.letters };
      if (!letters[letter]) return b;
      const words = letters[letter].words.filter(w => w !== word);
      if (words.length === 0) delete letters[letter];
      else letters[letter] = { ...letters[letter], words };
      return { ...b, letters };
    }));
  }

  function saveNote() {
    setBooks(prev => prev.map(b =>
      b.id === activeBookId ? { ...b, sessionNote: noteInput } : b
    ));
    setEditingNote(false);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = {
        id: Date.now().toString(),
        dataUrl: ev.target.result,
        letterRange: imgRange || "A-Z",
        note: imgNote,
      };
      setBooks(prev => prev.map(b =>
        b.id === activeBookId ? { ...b, images: [...(b.images || []), img] } : b
      ));
      setImgRange(""); setImgNote("");
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  function removeImage(imgId) {
    setBooks(prev => prev.map(b =>
      b.id === activeBookId ? { ...b, images: (b.images || []).filter(i => i.id !== imgId) } : b
    ));
  }

  function deleteBook(id) {
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBookId === id) { setView("library"); setActiveBookId(null); setActiveLetter(null); }
  }

  // ── Patterns ──
  const patterns = useMemo(() => {
    const wordMap = {};
    books.forEach(b => {
      Object.entries(b.letters || {}).forEach(([letter, data]) => {
        (data.words || []).forEach(word => {
          if (!wordMap[word]) wordMap[word] = [];
          wordMap[word].push({ bookId: b.id, bookTitle: b.title, letter });
        });
      });
    });
    const crossBook = Object.entries(wordMap)
      .filter(([_, a]) => new Set(a.map(x => x.bookId)).size >= 2)
      .sort((a, b) => new Set(b[1].map(x => x.bookId)).size - new Set(a[1].map(x => x.bookId)).size);
    const allWords = Object.entries(wordMap).sort((a, b) => b[1].length - a[1].length);
    return { crossBook, allWords, totalWords: Object.keys(wordMap).length };
  }, [books]);

  const bookStats = useCallback((book) => {
    const lk = Object.keys(book.letters || {});
    const words = lk.reduce((s, l) => s + (book.letters[l].words?.length || 0), 0);
    return { letters: lk.length, words };
  }, []);

  const filteredBooks = searchQuery
    ? books.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.author || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : books;

  // Derived values for book detail
  const bookColor = activeBook ? deweyColor(activeBook.dewey) : "#A09890";
  const bookImages = activeBook ? (activeBook.images || []) : [];
  const bookLetterEntries = activeBook ? Object.entries(activeBook.letters || {}).sort() : [];
  const activeLetterColor = activeLetter ? COLORS[LETTERS.indexOf(activeLetter) % COLORS.length] : "#A09890";
  const activeWords = (activeBook && activeLetter) ? (activeBook.letters[activeLetter]?.words || []) : [];

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ height: 4, background: "linear-gradient(90deg, #FF6B6B, #FF8C42, #F9C74F, #6BCB77, #4D96FF, #9B5DE5, #FF6B9D, #48CAE4, #C77DFF, #FFD93D)" }} />

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={S.logo}
            onClick={() => { setView("library"); setActiveBookId(null); setActiveLetter(null); }}
          >
            Neural Shelf
          </h1>
          <span style={S.logoSub}>indexing studio</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "patterns" && books.length > 0 && (
            <button onClick={() => setView("patterns")} style={S.ghostBtn}>Patterns</button>
          )}
          {view !== "library" && (
            <button
              onClick={() => { setView("library"); setActiveBookId(null); setActiveLetter(null); }}
              style={S.ghostBtn}
            >
              Library
            </button>
          )}
          <button onClick={() => setView("add")} style={S.primaryBtn}>+ Add Book</button>
        </div>
      </div>

      {/* ADD */}
      {view === "add" && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>Add to your shelf</h2>
            <input style={S.input} placeholder="Title *" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && document.getElementById("ns-author")?.focus()} />
            <input id="ns-author" style={{ ...S.input, marginTop: 8 }} placeholder="Author"
              value={newAuthor} onChange={e => setNewAuthor(e.target.value)}
              onKeyDown={e => e.key === "Enter" && document.getElementById("ns-dewey")?.focus()} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input id="ns-dewey" style={{ ...S.input, flex: "0 0 150px" }}
                placeholder="Dewey (e.g. 612.8)" value={newDewey}
                onChange={e => setNewDewey(e.target.value)} />
              <input style={{ ...S.input, flex: 1 }}
                placeholder="Tags, comma-separated" value={newTags}
                onChange={e => setNewTags(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBook()} />
            </div>
            {newDewey.trim() && (
              <p style={{ ...S.label, color: deweyColor(newDewey), marginTop: 8 }}>
                Dewey class {newDewey.trim()[0]}xx
              </p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={addBook} style={S.primaryBtn} disabled={!newTitle.trim()}>Add to library</button>
              <button onClick={() => setView("library")} style={S.ghostBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY */}
      {view === "library" && (
        <div style={S.content}>
          {books.length > 0 && (
            <input style={{ ...S.input, marginBottom: 16 }}
              placeholder="Search titles, authors, or tags..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          )}
          {filteredBooks.length === 0 && books.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
              <p style={{ ...S.muted, fontSize: 15, marginBottom: 4 }}>Your shelf is empty.</p>
              <p style={{ ...S.muted, fontSize: 13 }}>Add a book and start indexing.</p>
            </div>
          )}
          {filteredBooks.length === 0 && books.length > 0 && (
            <p style={{ ...S.muted, textAlign: "center", padding: 20 }}>No matches for that search.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredBooks.map(book => {
              const stats = bookStats(book);
              const color = deweyColor(book.dewey);
              return (
                <div key={book.id}
                  onClick={() => { setActiveBookId(book.id); setView("book"); setActiveLetter(null); setEditingNote(false); }}
                  style={S.bookRow}
                >
                  <div style={{ width: 5, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: "12px 12px 12px 14px" }}>
                    {book.dewey && <p style={{ ...S.label, color, marginBottom: 3 }}>{book.dewey}</p>}
                    <div style={S.bookTitle}>{book.title}</div>
                    {book.author && <div style={S.bookAuthor}>{book.author}</div>}
                    {(book.tags || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {book.tags.map(tag => (
                          <span key={tag} style={{ ...S.tagPill, color, borderColor: color }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {book.sessionNote ? (
                      <p style={{ ...S.muted, fontSize: 11, marginTop: 5, fontStyle: "italic" }}>
                        {book.sessionNote.slice(0, 80)}{book.sessionNote.length > 80 ? "..." : ""}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, padding: "12px 14px", justifyContent: "center", flexShrink: 0 }}>
                    {stats.words > 0 && <span style={S.stat}>{stats.words} terms</span>}
                    {stats.letters > 0 && <span style={S.stat}>{stats.letters} letters</span>}
                    {(book.images || []).length > 0 && <span style={S.stat}>{book.images.length} img</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOOK DETAIL */}
      {view === "book" && activeBook && (
        <div style={S.content}>
          <div style={{ marginBottom: 22, borderLeft: "4px solid " + bookColor, paddingLeft: 14 }}>
            {activeBook.dewey && <p style={{ ...S.label, color: bookColor, marginBottom: 4 }}>{activeBook.dewey}</p>}
            <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px 0" }}>
              {activeBook.title}
            </h2>
            {activeBook.author && <p style={{ ...S.muted, margin: 0 }}>{activeBook.author}</p>}
            {(activeBook.tags || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {activeBook.tags.map(tag => (
                  <span key={tag} style={{ ...S.tagPill, color: bookColor, borderColor: bookColor }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* session note */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={S.label}>Session notes</p>
              {!editingNote && (
                <button
                  onClick={() => { setEditingNote(true); setNoteInput(activeBook.sessionNote || ""); }}
                  style={{ ...S.ghostBtn, padding: "3px 10px", fontSize: 11 }}
                >
                  {activeBook.sessionNote ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editingNote ? (
              <div>
                <textarea
                  style={{ ...S.input, minHeight: 64, resize: "vertical", lineHeight: 1.5 }}
                  placeholder="e.g. A-C only, good but dense, return later to finish..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={saveNote} style={S.primaryBtn}>Save</button>
                  <button onClick={() => setEditingNote(false)} style={S.ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <p style={{ ...S.muted, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>
                {activeBook.sessionNote
                  ? activeBook.sessionNote
                  : "No notes yet. Good for things like: A-C only, return later."}
              </p>
            )}
          </div>

          {/* letters */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ ...S.label, marginBottom: 8 }}>Letters indexed</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {LETTERS.map(letter => {
                const hasData = (activeBook.letters[letter]?.words?.length || 0) > 0;
                const isActive = activeLetter === letter;
                const lc = COLORS[LETTERS.indexOf(letter) % COLORS.length];
                return (
                  <button key={letter} onClick={() => toggleLetter(letter)} style={{
                    width: 36, height: 36, borderRadius: 8,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", border: "none", transition: "all 0.12s",
                    background: isActive ? lc : hasData ? lc + "33" : "#F5F3EE",
                    color: isActive ? "#FFF" : hasData ? lc : "#C0B8A8",
                    boxShadow: isActive ? "0 2px 10px " + lc + "55" : "none",
                  }}>
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* active letter */}
          {activeLetter && (
            <div style={{ ...S.card, borderLeft: "3px solid " + activeLetterColor, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 34, fontWeight: 700, color: activeLetterColor, lineHeight: 1 }}>
                  {activeLetter}
                </span>
                <span style={S.label}>{activeWords.length} terms</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input style={{ ...S.input, flex: 1 }}
                  placeholder="Add term or comma-separated terms..."
                  value={wordInput} onChange={e => setWordInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addWord()} autoFocus />
                <button onClick={addWord} style={{ ...S.primaryBtn, background: activeLetterColor }} disabled={!wordInput.trim()}>
                  Add
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeWords.map(word => {
                  const shared = books.some(b => b.id !== activeBookId && Object.values(b.letters || {}).some(l => l.words?.includes(word)));
                  const wc = wordColor(word);
                  return (
                    <span key={word} title={shared ? "Appears in other books" : ""} style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: shared ? 600 : 400,
                      padding: "5px 12px", borderRadius: 20,
                      background: shared ? wc : "transparent",
                      color: shared ? "#FFF" : wc,
                      border: "2px solid " + wc,
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                      {shared && <span style={{ fontSize: 9 }}>&#x1F517;</span>}
                      {word}
                      <span onClick={() => removeWord(activeLetter, word)}
                        style={{ cursor: "pointer", opacity: 0.5, fontSize: 14, lineHeight: 1, marginLeft: 2 }}>
                        &times;
                      </span>
                    </span>
                  );
                })}
              </div>
              {activeWords.length === 0 && (
                <p style={{ ...S.muted, fontSize: 12, fontStyle: "italic" }}>No terms yet. Type above and press Enter.</p>
              )}
            </div>
          )}

          {/* all words */}
          {!activeLetter && bookLetterEntries.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <p style={{ ...S.label, marginBottom: 10 }}>All captured terms</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {bookLetterEntries.map(([letter, data]) =>
                  (data.words || []).map(word => {
                    const shared = books.some(b => b.id !== activeBookId && Object.values(b.letters || {}).some(l => l.words?.includes(word)));
                    const wc = wordColor(word);
                    return (
                      <span key={letter + word} style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: shared ? 600 : 400,
                        padding: "4px 10px", borderRadius: 18,
                        background: shared ? wc : "transparent",
                        color: shared ? "#FFF" : wc,
                        border: "1.5px solid " + wc,
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ fontSize: 9, opacity: 0.55, fontWeight: 700 }}>{letter}</span>
                        {shared && <span style={{ fontSize: 9 }}>&#x1F517;</span>}
                        {word}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* images */}
          <div style={S.card}>
            <p style={{ ...S.label, marginBottom: 12 }}>Index images</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input style={{ ...S.input, flex: "0 0 130px" }}
                placeholder="Letters (e.g. A-C)" value={imgRange}
                onChange={e => setImgRange(e.target.value)} />
              <input style={{ ...S.input, flex: 1, minWidth: 120 }}
                placeholder="Note (optional)" value={imgNote}
                onChange={e => setImgNote(e.target.value)} />
              <button onClick={() => fileRef.current && fileRef.current.click()} style={S.ghostBtn}>
                Upload image
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
            </div>
            {bookImages.length === 0 && (
              <p style={{ ...S.muted, fontSize: 12, fontStyle: "italic" }}>
                No images yet. Upload photos of your handwritten index pages.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bookImages.map(img => (
                <div key={img.id} style={{ border: "1px solid #EEEAE2", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#FAFAF8", borderBottom: "1px solid #EEEAE2" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...S.label, color: bookColor }}>{img.letterRange}</span>
                      {img.note && <span style={{ ...S.muted, fontSize: 11, fontStyle: "italic" }}>{img.note}</span>}
                    </div>
                    <button onClick={() => removeImage(img.id)} style={{ ...S.ghostBtn, padding: "2px 8px", fontSize: 11, color: "#C0A0A0" }}>
                      Remove
                    </button>
                  </div>
                  <img src={img.dataUrl} alt="index" style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "contain", background: "#F9F9F7" }} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { if (window.confirm("Remove this book from your library?")) deleteBook(activeBook.id); }}
            style={{ ...S.ghostBtn, color: "#C0A0A0", marginTop: 20, fontSize: 11 }}
          >
            Remove this book
          </button>
        </div>
      )}

      {/* PATTERNS */}
      {view === "patterns" && (
        <div style={S.content}>
          <h2 style={{ ...S.cardTitle, fontSize: 20, marginBottom: 20 }}>Patterns</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { n: books.length, label: "Books", c: COLORS[4] },
              { n: patterns.totalWords, label: "Unique terms", c: COLORS[5] },
              { n: patterns.crossBook.length, label: "Cross-book", c: COLORS[2] },
            ].map((s, i) => (
              <div key={i} style={{ background: "#FAFAF8", border: "1px solid #EEEAE2", borderRadius: 12, padding: "14px 18px", flex: "1 1 80px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 26, fontWeight: 700, color: s.c }}>{s.n}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#8B8580", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {patterns.crossBook.length > 0 && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              <p style={{ ...S.label, marginBottom: 14 }}>Terms appearing across books</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {patterns.crossBook.map(([word, appearances]) => {
                  const uniqueBooks = [...new Set(appearances.map(a => a.bookTitle))];
                  const wc = wordColor(word);
                  return (
                    <div key={word} style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: wc, color: "#FFF", flexShrink: 0 }}>
                        {word}
                      </span>
                      <div style={{ paddingTop: 5 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#8B8580" }}>
                          {uniqueBooks.join(" · ")}
                        </span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0B8A8", marginLeft: 6 }}>
                          {uniqueBooks.length} books
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {patterns.crossBook.length === 0 && books.length >= 2 && (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={S.muted}>No overlapping terms yet. Keep indexing - connections will surface.</p>
            </div>
          )}
          {books.length < 2 && (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={S.muted}>Index 2+ books to start seeing cross-book patterns.</p>
            </div>
          )}

          {patterns.allWords.length > 0 && (
            <div style={{ ...S.card, marginTop: 12 }}>
              <p style={{ ...S.label, marginBottom: 12 }}>All terms by frequency</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {patterns.allWords.slice(0, 80).map(([word, appearances]) => {
                  const freq = appearances.length;
                  const isMulti = new Set(appearances.map(a => a.bookId)).size > 1;
                  const wc = wordColor(word);
                  return (
                    <span key={word} style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: freq > 3 ? 16 : freq > 1 ? 13 : 11,
                      fontWeight: freq > 2 ? 700 : 400,
                      padding: "4px 11px", borderRadius: 18,
                      background: isMulti ? wc : "transparent",
                      color: isMulti ? "#FFF" : wc,
                      border: "1.5px solid " + wc,
                    }}>
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

const S = {
  root: { width: "100vw", minHeight: "100vh", background: "#FDFCFA", fontFamily: "'DM Sans', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #EEEAE2", flexWrap: "wrap", gap: 10 },
  logo: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0, cursor: "pointer" },
  logoSub: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A09890", fontWeight: 400 },
  content: { maxWidth: 660, margin: "0 auto", padding: "24px 20px" },
  card: { background: "#FAFAF8", border: "1px solid #EEEAE2", borderRadius: 12, padding: "16px 18px", marginBottom: 12 },
  cardTitle: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, fontWeight: 600, color: "#1A1A1A", margin: "0 0 14px 0" },
  input: { fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1A1A", background: "#FFF", border: "1px solid #E0DCD4", borderRadius: 8, padding: "9px 14px", width: "100%", outline: "none", boxSizing: "border-box", lineHeight: 1.4 },
  label: { fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 },
  muted: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#A09890", margin: 0 },
  primaryBtn: { fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#FFF", background: "#1A1A1A", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap" },
  ghostBtn: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#8B8580", background: "transparent", border: "1px solid #E0DCD4", borderRadius: 8, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  bookRow: { display: "flex", alignItems: "stretch", borderRadius: 10, background: "#FAFAF8", border: "1px solid #EEEAE2", cursor: "pointer", overflow: "hidden" },
  bookTitle: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A" },
  bookAuthor: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A09890", marginTop: 2 },
  tagPill: { fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, padding: "2px 9px", borderRadius: 12, border: "1.5px solid", background: "transparent" },
  stat: { fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0B8A8" },
};
