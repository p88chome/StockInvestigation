import type { StockNews, InsertStockNews, XPost, InsertXPost } from "@shared/schema";
import { db } from "./firebase";

export interface IStorage {
  getAllNews(): Promise<StockNews[]>;
  getNewsByTicker(ticker: string): Promise<StockNews[]>;
  insertNews(news: InsertStockNews): Promise<StockNews>;
  insertManyNews(newsList: InsertStockNews[]): Promise<StockNews[]>;
  clearAllNews(): Promise<void>;
  getAllXPosts(): Promise<XPost[]>;
  insertManyXPosts(posts: InsertXPost[]): Promise<XPost[]>;
  clearAllXPosts(): Promise<void>;
}

export class FirebaseStorage implements IStorage {
  private newsCollection = db.collection("news");
  private xPostsCollection = db.collection("x_posts");

  async getAllNews(): Promise<StockNews[]> {
    const snapshot = await this.newsCollection.orderBy("fetchedAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockNews));
  }

  async getNewsByTicker(ticker: string): Promise<StockNews[]> {
    const snapshot = await this.newsCollection.where("ticker", "==", ticker).orderBy("fetchedAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockNews));
  }

  async insertNews(news: InsertStockNews): Promise<StockNews> {
    const docRef = await this.newsCollection.add(news);
    return { id: docRef.id, ...news };
  }

  async insertManyNews(newsList: InsertStockNews[]): Promise<StockNews[]> {
    if (newsList.length === 0) return [];
    
    // Firestore batch writes support up to 500 operations. Safe to assume newsList is < 500.
    const batch = db.batch();
    const results: StockNews[] = [];
    
    for (const news of newsList) {
      const docRef = this.newsCollection.doc();
      batch.set(docRef, news);
      results.push({ id: docRef.id, ...news });
    }
    
    await batch.commit();
    return results;
  }

  async clearAllNews(): Promise<void> {
    // Note: For large collections, this should be done in smaller batches or via Cloud Functions.
    // For our AI simulated data size (a few dozen elements), sweeping get/delete is fine.
    const snapshot = await this.newsCollection.get();
    if (snapshot.empty) return;
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async getAllXPosts(): Promise<XPost[]> {
    const snapshot = await this.xPostsCollection.orderBy("fetchedAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as XPost));
  }

  async insertManyXPosts(posts: InsertXPost[]): Promise<XPost[]> {
    if (posts.length === 0) return [];
    
    const batch = db.batch();
    const results: XPost[] = [];
    
    for (const post of posts) {
      const docRef = this.xPostsCollection.doc();
      batch.set(docRef, post);
      results.push({ id: docRef.id, ...post });
    }
    
    await batch.commit();
    return results;
  }

  async clearAllXPosts(): Promise<void> {
    const snapshot = await this.xPostsCollection.get();
    if (snapshot.empty) return;
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

export const storage = new FirebaseStorage();
