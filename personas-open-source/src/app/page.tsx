'use client';

import { SetStateAction, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, startAfter, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import { Mixpanel } from '@/lib/mixpanel';
import { useInView } from 'react-intersection-observer';
import { Header } from '@/components/Header';
import { InputArea } from '@/components/InputArea';
import { ChatbotList } from '@/components/ChatbotList';
import { Footer } from '@/components/Footer';
import { Chatbot, TwitterProfile, LinkedinProfile } from '@/types/profiles';

const formatTwitterAvatarUrl = (url: string): string => {
  if (!url) return '/omi-avatar.svg';
  let formattedUrl = url.replace('http://', 'https://');
  formattedUrl = formattedUrl.replace('_normal', '');
  if (formattedUrl.includes('pbs.twimg.com')) {
    formattedUrl = formattedUrl.replace('/profile_images/', '/profile_images/');
  }
  return formattedUrl;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hour12: false,
  }).format(date).replace(',', ' at');
};

const fetchTwitterTimeline = async (screenname: string) => {
  try {
    const response = await fetch(`https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/timeline.php?screenname=${screenname}`, {
      headers: {
        'x-rapidapi-key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY!,
        'x-rapidapi-host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST!,
      },
    });

    const data = await response.json();

    const tweets = [];
    if (data.timeline) {
      for (const tweet of Object.values(data.timeline)) {
        const tweetData = tweet as any;
        if (tweets.length >= 30) break;
        if (tweetData.text && !tweetData.text.startsWith('RT @')) {
          tweets.push(tweetData.text);
        }
      }
    }

    return tweets;
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return [];
  }
};

export default function HomePage() {
  const router = useRouter();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const { ref, inView } = useInView();
  const [handle, setHandle] = useState('');

  const handleInputChange = (e: { target: { value: SetStateAction<string>; }; }) => {
    setHandle(e.target.value);
  };

  const handleCreatePersona = () => {
    const handlers = [
      fetchTwitterProfile,
      fetchLinkedinProfile,
      // Add new handlers here
    ];

    let successCount = 0;
    let totalHandlers = handlers.length;

    const checkForErrors = () => {
      if (successCount === 0) {
        toast.error('No profiles found for the given handle.');
      }
    };

    handlers.forEach(handler => {
      handler(handle).then(success => {
        if (success) {
          successCount++;
        }
        totalHandlers--;
        if (totalHandlers === 0) {
          checkForErrors();
        }
      });
    });
  };

  const BOTS_PER_PAGE = 50;

  useEffect(() => {
    // Identify the user first
    Mixpanel.identify();

    // Then track the page view
    Mixpanel.track('Page View', {
      page: 'Home',
      url: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }, []);

  const fetchChatbots = async (isInitial = true) => {
    try {
      const chatbotsCollection = collection(db, 'plugins_data');
      let q = query(
        chatbotsCollection,
        orderBy('sub_count', 'desc')
      );

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc), limit(BOTS_PER_PAGE));
      } else {
        q = query(q, limit(BOTS_PER_PAGE));
      }

      const querySnapshot = await getDocs(q);

      // Single Map for all bots, keyed by lowercase username
      const allBotsMap = new Map();

      querySnapshot.docs.forEach(doc => {
        const bot = { id: doc.id, ...doc.data() } as Chatbot;
        const normalizedUsername = bot.username?.toLowerCase().trim();
        const category = bot.category;

        if (!normalizedUsername || !bot.name) return;

        const key = `${normalizedUsername}-${category}`;
        allBotsMap.set(key, bot);
      });

      const uniqueBots = Array.from(allBotsMap.values());

      if (isInitial) {
        setChatbots(uniqueBots);
      } else {
        setChatbots(prev => {
          const masterMap = new Map();

          // First add existing bots to master map
          prev.forEach(bot => {
            const username = bot.username?.toLowerCase().trim();
            const category = bot.category;
            if (username) {
              const key = `${username}-${category}`;
              masterMap.set(key, bot);
            }
          });

          uniqueBots.forEach(bot => {
            const username = bot.username?.toLowerCase().trim();
            const category = bot.category;
            if (username) {
              const key = `${username}-${category}`;
              masterMap.set(key, bot);
            }
          });

          return Array.from(masterMap.values())
            .sort((a, b) => (b.sub_count || 0) - (a.sub_count || 0));
        });
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === BOTS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching chatbots:', error);
      setError('Failed to load chatbots.');
      toast.error('Failed to load chatbots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatbots();

  }, []);

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchChatbots(false);
    }
  }, [inView]);

  const handleChatbotClick = (bot: Chatbot) => {
    router.push(`/chat?id=${encodeURIComponent(bot.id)}`);
  };

  const filteredChatbots = chatbots.filter(bot =>
    bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (bot.username && bot.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const fetchTwitterProfile = async (twitterHandle: string) => {
    if (!twitterHandle) return false;

    const cleanHandle = twitterHandle.replace('@', '');

    setIsCreating(true);
    try {
      const q = query(
        collection(db, 'plugins_data'),
        where('username', '==', cleanHandle.toLowerCase())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        toast.success('Profile already exists, redirecting...');
        router.push(`/chat?id=${existingDoc.id}`);
        return true;
      }

      const profileResponse = await fetch(`https://${process.env.NEXT_PUBLIC_RAPIDAPI_HOST}/screenname.php?screenname=${cleanHandle}`, {
        headers: {
          'x-rapidapi-key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY!,
          'x-rapidapi-host': process.env.NEXT_PUBLIC_RAPIDAPI_HOST!,
        },
      });

      if (!profileResponse.ok) {
        return false;
      }

      const profileData: TwitterProfile = await profileResponse.json();

      if (!profileData || !profileData.name) {
        return false;
      }

      const recentTweets = await fetchTwitterTimeline(cleanHandle);

      const formattedAvatarUrl = formatTwitterAvatarUrl(profileData.avatar);

      const enhancedDesc = `${profileData.desc || 'No description available'}\n\nHere are my recent tweets:\n${recentTweets.join('\n')}`;

      const extraPromptRules = process.env.NEXT_PUBLIC_EXTRA_PROMPT_RULES ?? "";

      const fullChatPrompt = `You are ${profileData.name} AI, you must personify ${profileData.name} as well as you can.

Style:
- Interactive highly opinionated messages and questions.
- Reference your tweets naturally

Rules:
- Never mention being AI
- No ** or formal language
- 2-3 sentences for response. Never more than 20 words.
- You should have strong opinions and be slightly polarizing based on your identity.
- You must make the conversation flow. You excel at coherent conversations.
${extraPromptRules}

Recent activity on Twitter:\n"${enhancedDesc}" which you can use for your personality. Responses should help the conversation go deeper. You have strong opinions, slightly controversial.`;


      try {
        const createdAtFormatted = formatDate(new Date().toISOString());
        const docRef = await addDoc(collection(db, 'plugins_data'), {
          username: cleanHandle.toLowerCase().replace('@', ''),
          avatar: formattedAvatarUrl,
          profile: profileData.desc || 'No description available',
          desc: enhancedDesc,
          name: profileData.name,
          sub_count: profileData.sub_count || 0,
          category: 'twitter',
          created_at: createdAtFormatted,
          chat_prompt: fullChatPrompt,
        });

        toast.success('Profile saved successfully!');

        router.push(`/chat?id=${docRef.id}`);
        return true;
      } catch (firebaseError) {
        console.error('Firebase error:', firebaseError);
        toast.error('Failed to save profile');
        return false;
      }

    } catch (error) {
      console.error('Error fetching Twitter profile:', error);
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  
  const fetchLinkedinProfile = async (linkedinHandle: string) => {
    console.log('Starting LinkedIn profile fetch for handle:', linkedinHandle);
    
    if (!linkedinHandle) {
      console.log('No LinkedIn handle provided, returning false');
      return false;
    }
    
    const cleanHandle = linkedinHandle.replace('@', '');
    console.log('Cleaned handle:', cleanHandle);
    
    setIsCreating(true);
    try {
      const q = query(
        collection(db, 'plugins_data'),
        where('username', '==', cleanHandle.toLowerCase())
      );
           
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        toast.success('Profile already exists, redirecting...');
        router.push(`/chat?id=${existingDoc.id}`);
        return true;
      }

      const encodedHandle = encodeURIComponent(cleanHandle);
      
      const profileResponse = await fetch(`https://${process.env.NEXT_PUBLIC_LINKEDIN_API_HOST}/profile-data-connection-count-posts?username=${encodedHandle}`, {
        headers: {
          'x-rapidapi-key': process.env.NEXT_PUBLIC_LINKEDIN_API_KEY!,
          'x-rapidapi-host': process.env.NEXT_PUBLIC_LINKEDIN_API_HOST!,
        },
      });
      
      if (!profileResponse.ok) {
        console.log('API response not ok:', profileResponse.status, profileResponse.statusText);
        return false;
      }

      
      const profileData: LinkedinProfile = await profileResponse.json();

      if (!profileData || !profileData.data.firstName) {
        console.log('Invalid profile data received');
        return false;
      }

      const formattedAvatarUrl = profileData?.data?.profilePicture || '/omi-avatar.svg';
      const fullName = `${profileData?.data?.firstName || ''} ${profileData?.data?.lastName || ''}`.trim();
      const headline = profileData?.data?.headline || 'No headline available';
      const summary = profileData?.data?.summary || 'No summary available';
      
      const positions = Array.isArray(profileData?.data?.position) 
        ? profileData.data.position.map(pos => {
            const title = pos?.title || 'Unknown Title';
            const company = pos?.companyName || 'Unknown Company';
            const startYear = pos?.start?.year || 'N/A';
            const endYear = pos?.end?.year || 'Present';
            return `${title} at ${company} (${startYear} - ${endYear})`;
          }).join(', ') 
        : 'No positions available';

      const skills = Array.isArray(profileData?.data?.skills) 
        ? profileData.data.skills.map(skill => skill?.name || '').filter(Boolean).join(', ') 
        : 'No skills available';

      const recentPosts = Array.isArray(profileData?.posts) 
        ? profileData.posts.map(post => post?.text || '').filter(Boolean).join('\n')
        : 'No recent posts available';

      const enhancedDesc = `${summary}\n\nPositions: ${positions}\n\nSkills: ${skills}\n\nRecent Posts:\n${recentPosts}`;
      console.log('Enhanced description:', enhancedDesc);

      const extraPromptRules = process.env.NEXT_PUBLIC_EXTRA_PROMPT_RULES ?? "";

      const fullChatPrompt = `You are ${fullName}, an AI persona. Here is some information about you:

Name: ${fullName}
Headline: ${headline}
Summary: ${summary}
Positions: ${positions}
Skills: ${skills}

Style:
- Interactive highly opinionated messages and questions.
- Reference your experiences and skills naturally.

Rules:
- Never mention being AI
- No ** or formal language
- 2-3 sentences for response. Never more than 20 words.
- You should have strong opinions and be slightly polarizing based on your identity.
- You must make the conversation flow. You excel at coherent conversations.
${extraPromptRules}

Recent activity on Linkedin:\n"${enhancedDesc}" which you can use for your personality. Responses should help the conversation go deeper. You have strong opinions, slightly controversial.`;


      try {
        const createdAtFormatted = formatDate(new Date().toISOString());
        const docRef = await addDoc(collection(db, 'plugins_data'), {
          username: cleanHandle.toLowerCase().replace('@', ''),
          avatar: formattedAvatarUrl,
          profile: summary,
          desc: enhancedDesc,
          name: fullName,
          sub_count: profileData.follower || 0,
          category: 'linkedin',
          created_at: createdAtFormatted,
          chat_prompt: fullChatPrompt,
          connection_count: profileData.connection,
        });

        toast.success('Profile saved successfully!');

        router.push(`/chat?id=${docRef.id}`);
        return true;
      } catch (firebaseError) {
        console.error('Firebase error:', firebaseError);
        toast.error('Failed to save profile');
        return false;
      }

    } catch (error) {
      console.error('Error fetching LinkedIn profile:', error);
      return false;
    } finally {
      console.log('Finishing LinkedIn profile fetch');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="flex flex-col items-center px-4 py-8 md:py-16">
        <InputArea
          handle={handle}
          handleInputChange={handleInputChange}
          handleCreatePersona={handleCreatePersona}
          isCreating={isCreating}
        />
        {!loading && filteredChatbots.length > 0 && (
          <ChatbotList
            chatbots={filteredChatbots}
            handleChatbotClick={handleChatbotClick}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            ref={ref}
            hasMore={hasMore}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}

