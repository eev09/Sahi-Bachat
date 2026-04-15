import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, ArrowBigUp, Plus, X, Send, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  upvotes: number;
  createdAt: any;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

export function Forum() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!user) return;

    const dummyPosts: Post[] = [
      {
        id: 'dummy1',
        authorId: 'system',
        authorName: 'Sahi Sahayika',
        title: t('dummy_post_1_title'),
        content: t('dummy_post_1_content'),
        upvotes: 24,
        createdAt: { toDate: () => new Date() }
      },
      {
        id: 'dummy2',
        authorId: 'system',
        authorName: 'Rahul Kumar',
        title: t('dummy_post_2_title'),
        content: t('dummy_post_2_content'),
        upvotes: 15,
        createdAt: { toDate: () => new Date(Date.now() - 86400000) }
      },
      {
        id: 'dummy3',
        authorId: 'system',
        authorName: 'Priya Singh',
        title: t('dummy_post_3_title'),
        content: t('dummy_post_3_content'),
        upvotes: 8,
        createdAt: { toDate: () => new Date(Date.now() - 172800000) }
      },
      {
        id: 'dummy4',
        authorId: 'system',
        authorName: 'Amit Sharma',
        title: t('dummy_post_4_title'),
        content: t('dummy_post_4_content'),
        upvotes: 12,
        createdAt: { toDate: () => new Date(Date.now() - 259200000) }
      },
      {
        id: 'dummy5',
        authorId: 'system',
        authorName: 'Sunita Devi',
        title: t('dummy_post_5_title'),
        content: t('dummy_post_5_content'),
        upvotes: 19,
        createdAt: { toDate: () => new Date(Date.now() - 345600000) }
      },
      {
        id: 'dummy6',
        authorId: 'system',
        authorName: 'Vikram Singh',
        title: t('dummy_post_6_title'),
        content: t('dummy_post_6_content'),
        upvotes: 7,
        createdAt: { toDate: () => new Date(Date.now() - 432000000) }
      }
    ];

    // Set initial dummy posts
    setPosts(dummyPosts);

    const q = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts([...dummyPosts, ...fetchedPosts]);
    }, (error) => {
      console.error("Forum onSnapshot error:", error);
      // Keep dummy posts on error
      handleFirestoreError(error, OperationType.LIST, 'forumPosts');
    });
    return unsubscribe;
  }, [user, i18n.language]);

  useEffect(() => {
    if (selectedPost) {
      const path = `forumPosts/${selectedPost.id}/comments`;
      const q = query(collection(db, 'forumPosts', selectedPost.id, 'comments'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return unsubscribe;
    }
  }, [selectedPost]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTitle || !newContent) return;
    try {
      await addDoc(collection(db, 'forumPosts'), {
        authorId: profile.uid,
        authorName: profile.name,
        title: newTitle,
        content: newContent,
        upvotes: 0,
        createdAt: serverTimestamp(),
      });
      setIsCreating(false);
      setNewTitle('');
      setNewContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'forumPosts');
    }
  };

  const handleUpvote = async (postId: string) => {
    try {
      await updateDoc(doc(db, 'forumPosts', postId), {
        upvotes: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `forumPosts/${postId}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedPost || !newComment) return;
    try {
      await addDoc(collection(db, 'forumPosts', selectedPost.id, 'comments'), {
        postId: selectedPost.id,
        authorId: profile.uid,
        authorName: profile.name,
        content: newComment,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `forumPosts/${selectedPost.id}/comments`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    // window.confirm is not recommended in iframes, so we'll just delete for the demo
    try {
      await deleteDoc(doc(db, 'forumPosts', postId));
      if (selectedPost?.id === postId) setSelectedPost(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `forumPosts/${postId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{t('community_forum')}</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-orange-200"
        >
          <Plus className="w-5 h-5" />
          {t('create_post')}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{t('create_post')}</h3>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreatePost} className="space-y-4">
                <input
                  type="text"
                  placeholder={t('title')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <textarea
                  placeholder={t('whats_on_your_mind')}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  {t('post')}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {posts.map((post) => (
          <motion.div
            key={post.id}
            layoutId={post.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 flex gap-4"
          >
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => handleUpvote(post.id)}
                className="p-1 hover:bg-orange-50 rounded-lg text-gray-400 hover:text-orange-600 transition-colors"
              >
                <ArrowBigUp className="w-8 h-8" />
              </button>
              <span className="font-bold text-gray-700">{post.upvotes}</span>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-bold text-orange-600">u/{post.authorName}</span>
                  <span>•</span>
                  <span>{post.createdAt?.toDate?.()?.toLocaleDateString() || '...'}</span>
                </div>
                {profile?.uid === post.authorId && (
                  <button onClick={() => handleDeletePost(post.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 
                className="text-lg font-bold text-gray-800 cursor-pointer hover:text-orange-600"
                onClick={() => setSelectedPost(post)}
              >
                {post.title}
              </h3>
              <p className="text-gray-600 line-clamp-3">{post.content}</p>
              <div className="flex items-center gap-4 pt-2">
                <button 
                  onClick={() => setSelectedPost(post)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:bg-gray-50 px-2 py-1 rounded-lg"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('comments')}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-2xl h-[90vh] md:h-[80vh] rounded-t-3xl md:rounded-3xl flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold truncate pr-4">{selectedPost.title}</h3>
                <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-bold text-orange-600">u/{selectedPost.authorName}</span>
                    <span>•</span>
                    <span>{selectedPost.createdAt?.toDate?.()?.toLocaleDateString() || '...'}</span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedPost.content}</p>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-bold text-gray-700">{t('comments')}</h4>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('add_comment')}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-orange-600 text-white p-2 rounded-xl hover:bg-orange-700 transition-all"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>

                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-xl p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-bold text-orange-600">u/{comment.authorName}</span>
                          <span>•</span>
                          <span>{comment.createdAt?.toDate?.()?.toLocaleDateString() || '...'}</span>
                        </div>
                        <p className="text-gray-700 text-sm">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
