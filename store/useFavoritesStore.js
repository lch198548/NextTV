'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      // 收藏列表
      favorites: [],

      // 添加收藏
      addFavorite: (item) => set((state) => {
        const { source, id, title, type, genre, poster } = item;

        // 生成唯一key
        const key = `${source}-${id}`;

        // 检查是否已收藏
        const exists = state.favorites.some(
          (fav) => `${fav.source}-${fav.id}` === key
        );

        if (exists) {
          return state; // 已存在，不重复添加
        }

        // 创建新收藏项
        const newFavorite = {
          source,
          id,
          title,
          type, // movie 或 tv
          genre,
          poster,
          addedAt: Date.now(),
        };

        return {
          favorites: [newFavorite, ...state.favorites], // 新收藏在前
        };
      }),

      // 删除收藏
      removeFavorite: (source, id) => set((state) => ({
        favorites: state.favorites.filter(
          (fav) => !(fav.source === source && fav.id === id)
        ),
      })),

      // 检查是否已收藏
      isFavorited: (source, id) => {
        const state = get();
        return state.favorites.some(
          (fav) => fav.source === source && fav.id === id
        );
      },

      // 切换收藏状态
      toggleFavorite: (item) => {
        const state = get();
        const isFav = state.isFavorited(item.source, item.id);

        if (isFav) {
          state.removeFavorite(item.source, item.id);
        } else {
          state.addFavorite(item);
        }

        return !isFav; // 返回新状态
      },

      // 清空所有收藏
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: 'streambox-favorites',
    }
  )
);
