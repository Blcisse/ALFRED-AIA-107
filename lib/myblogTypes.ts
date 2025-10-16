// lib/myblogTypes.ts
export type Genre = {
    id: string;
    name: string;
    rank: number; // 1 = highest priority
  };
  
  export type Article = {
    id: string;            // stable hash/uuid
    genre: string;         // genre name at fetch time
    title: string;
    subtitle?: string;
    snippet?: string;
    imageUrl?: string | null;
    source?: string;
    url: string;           // canonical link
    publishedAt?: string;  // ISO
    score?: number;        // popularity/importance
    fetchedAt: string;     // ISO (when we stored it)
  };
  
  export type MyBlogDB = {
    genres: Genre[];
    articles: Article[]; // we keep recent ones; UI shows "today"
    lastRefreshRequestedAt?: string; // ISO
  };
  