import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Calendar, Clock, MapPin, Trophy, Wifi, WifiOff, ChevronDown, Globe, Play, Users } from 'lucide-react';

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes to match backend cache
const API_BASE_URL = 'https://sport-scheduler-backend.onrender.com/api';

const UpcomingMatches = () => {
  const [matches, setMatches] = useState([]);
  const [competitions, setCompetitions] = useState({});
  const [selectedCompetition, setSelectedCompetition] = useState('premier-league');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentCompetitionInfo, setCurrentCompetitionInfo] = useState(null);
  const [todayMatches, setTodayMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  
  // In-memory cache to replace localStorage
  const [cache, setCache] = useState({});

  // Get cache key for specific competition
  const getCacheKey = useCallback((competitionKey) => `footballMatches_${competitionKey}`, []);

  // Check if cached data is still valid for specific competition
  const getCachedData = useCallback((competitionKey) => {
    try {
      const cacheKey = getCacheKey(competitionKey);
      const cached = cache[cacheKey];
      if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached;
      }
    } catch (e) {
      console.error('Error reading cache:', e);
    }
    return null;
  }, [cache, getCacheKey]);

  // Save data to cache for specific competition
  const setCachedData = useCallback((competitionKey, data) => {
    try {
      const cacheKey = getCacheKey(competitionKey);
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      setCache(prev => ({
        ...prev,
        [cacheKey]: cacheData
      }));
    } catch (e) {
      console.error('Error saving to cache:', e);
    }
  }, [getCacheKey]);

  // Fetch available competitions
  const fetchCompetitions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/competitions`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCompetitions(result.competitions);
        }
      }
    } catch (err) {
      console.error('Error fetching competitions:', err);
    }
  }, []);

  // Fetch matches from API for specific competition
  const fetchMatches = useCallback(async (forceRefresh = false, competitionKey = selectedCompetition) => {
    // Try cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = getCachedData(competitionKey);
      if (cached) {
        setMatches(cached.data.data || []);
        setLastUpdated(cached.data.timestamp);
        if (cached.data.competition) {
          setCurrentCompetitionInfo(cached.data.competition);
        }
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/matches?league=${competitionKey}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setMatches(result.data);
        setLastUpdated(result.timestamp);
        setCurrentCompetitionInfo(result.competition);
        
        // Cache the entire result
        setCachedData(competitionKey, result);
      } else {
        throw new Error(result.message || 'Failed to fetch matches');
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError(err.message);
      
      // Try to use cached data as fallback
      const cached = getCachedData(competitionKey);
      if (cached) {
        setMatches(cached.data.data || []);
        setLastUpdated(cached.data.timestamp);
        if (cached.data.competition) {
          setCurrentCompetitionInfo(cached.data.competition);
        }
        setError('Using cached data - network unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCompetition, getCachedData, setCachedData]);

  // Fetch today's matches
  const fetchTodayMatches = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/matches/today`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTodayMatches(result.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching today matches:', err);
    }
  }, []);

  // Fetch live matches
  const fetchLiveMatches = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/matches/live`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLiveMatches(result.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching live matches:', err);
    }
  }, []);

  // Format date and time for the new API structure
  const formatDateTime = useMemo(() => {
    return (dateTime) => {
      if (!dateTime) return { dateStr: 'TBD', timeStr: 'TBD', isToday: false };
      
      try {
        const matchDate = new Date(dateTime);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
        
        const isToday = matchDay.getTime() === today.getTime();
        const isTomorrow = matchDay.getTime() === today.getTime() + 24 * 60 * 60 * 1000;
        
        let dateStr;
        if (isToday) {
          dateStr = 'Today';
        } else if (isTomorrow) {
          dateStr = 'Tomorrow';
        } else {
          dateStr = matchDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          });
        }
        
        const timeStr = matchDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
        
        return { dateStr, timeStr, isToday };
      } catch (e) {
        return { dateStr: 'TBD', timeStr: 'TBD', isToday: false };
      }
    };
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle competition selection change
  const handleCompetitionChange = useCallback((newCompetition) => {
    setSelectedCompetition(newCompetition);
    setMatches([]);
    setLoading(true);
    setError(null);
    fetchMatches(false, newCompetition);
  }, [fetchMatches]);

  // Handle tab change
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'today') {
      fetchTodayMatches();
    } else if (tab === 'live') {
      fetchLiveMatches();
    }
  }, [fetchTodayMatches, fetchLiveMatches]);

  // Initial data fetch
  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  // Fetch matches when component mounts or competition changes
  useEffect(() => {
    if (Object.keys(competitions).length > 0) {
      fetchMatches();
    }
  }, [fetchMatches, competitions]);

  // Auto-refresh live matches
  useEffect(() => {
    let interval;
    if (activeTab === 'live') {
      interval = setInterval(fetchLiveMatches, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, fetchLiveMatches]);

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="text-sm font-medium text-gray-400">VS</div>
            <div className="flex items-center space-x-4">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="h-3 bg-gray-200 rounded w-20"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // Match card component
  const MatchCard = ({ match, showCompetition = false }) => {
    const { dateStr, timeStr, isToday } = formatDateTime(match.dateTime);
    const isLive = match.status === 'LIVE' || match.status === 'IN_PLAY';
    
    return (
      <div
        className={`bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-all duration-200 transform hover:-translate-y-1 ${
          isToday ? 'ring-2 ring-green-400 bg-green-50' : ''
        } ${isLive ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
      >
        {/* Live/Today Badge */}
        {(isLive || isToday) && (
          <div className="flex justify-center mb-4">
            <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${
              isLive ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`}>
              {isLive ? 'LIVE' : 'TODAY'}
            </span>
          </div>
        )}

        {/* Competition info for mixed views */}
        {showCompetition && match.competition && (
          <div className="flex items-center justify-center mb-3">
            {match.competitionEmblem && (
              <img 
                src={match.competitionEmblem} 
                alt={match.competition}
                className="w-5 h-5 mr-2"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <span className="text-xs font-medium text-gray-600">{match.competition}</span>
          </div>
        )}

        {/* Teams */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1">
            {match.homeTeamCrest && (
              <img 
                src={match.homeTeamCrest} 
                alt={match.homeTeam}
                className="w-8 h-8 object-contain"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <span className="font-semibold text-gray-800 text-lg">{match.homeTeam}</span>
          </div>
          
          <div className="px-4">
            {isLive && match.score ? (
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">
                  {match.score.fullTime.home || 0} - {match.score.fullTime.away || 0}
                </div>
                {match.minute && (
                  <div className="text-xs text-red-500">{match.minute}'</div>
                )}
              </div>
            ) : (
              <span className="text-sm font-medium text-gray-400">VS</span>
            )}
          </div>
          
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <span className="font-semibold text-gray-800 text-lg text-right">{match.awayTeam}</span>
            {match.awayTeamCrest && (
              <img 
                src={match.awayTeamCrest} 
                alt={match.awayTeam}
                className="w-8 h-8 object-contain"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
          </div>
        </div>

        {/* Match Details */}
        <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>{dateStr}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{timeStr}</span>
            </div>
          </div>
          
          {match.venue && match.venue !== 'TBD' && (
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span className="text-xs">{match.venue}</span>
            </div>
          )}
        </div>

        {/* Matchday info */}
        {match.matchday && (
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Matchday {match.matchday}</span>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{match.status}</span>
          </div>
        )}
      </div>
    );
  };

  const currentData = activeTab === 'upcoming' ? matches : 
                     activeTab === 'today' ? todayMatches : 
                     liveMatches;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {currentCompetitionInfo?.emblem ? (
              <img 
                src={currentCompetitionInfo.emblem} 
                alt={currentCompetitionInfo.name}
                className="w-12 h-12 mr-3"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
            ) : null}
            <Trophy className="w-8 h-8 text-green-600 mr-2" style={{ display: currentCompetitionInfo?.emblem ? 'none' : 'block' }} />
            <div>
              <h1 className="text-4xl font-bold text-gray-800">
                {activeTab === 'upcoming' ? (currentCompetitionInfo?.name || 'Football Matches') :
                 activeTab === 'today' ? 'Today\'s Matches' :
                 'Live Matches'}
              </h1>
              {currentCompetitionInfo?.country && activeTab === 'upcoming' && (
                <p className="text-sm text-gray-500 flex items-center justify-center mt-1">
                  <Globe className="w-4 h-4 mr-1" />
                  {currentCompetitionInfo.country}
                </p>
              )}
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-lg p-1 shadow-sm border">
              {[
                { key: 'upcoming', label: 'Upcoming', icon: Calendar },
                { key: 'today', label: 'Today', icon: Clock },
                { key: 'live', label: 'Live', icon: Play }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
                    activeTab === key 
                      ? 'bg-green-500 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {key === 'live' && liveMatches.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
                      {liveMatches.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Competition Selector - Only show for upcoming matches */}
          {activeTab === 'upcoming' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Competition
              </label>
              <div className="relative inline-block min-w-64">
                <select
                  value={selectedCompetition}
                  onChange={(e) => handleCompetitionChange(e.target.value)}
                  disabled={loading}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed w-full text-left shadow-sm"
                >
                  {Object.entries(competitions).map(([key, competition]) => (
                    <option key={key} value={key}>
                      {competition.name} • {competition.country}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
          
          {/* Status indicators */}
          <div className="flex items-center justify-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {lastUpdated && activeTab === 'upcoming' && (
              <div className="text-xs text-gray-500">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => {
              if (activeTab === 'upcoming') fetchMatches(true);
              else if (activeTab === 'today') fetchTodayMatches();
              else if (activeTab === 'live') fetchLiveMatches();
            }}
            disabled={loading}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors duration-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && currentData.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          /* Matches List */
          <div className="space-y-4">
            {currentData.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-500 mb-2">
                  {activeTab === 'live' ? 'No live matches' : 
                   activeTab === 'today' ? 'No matches today' : 
                   'No upcoming matches'}
                </h3>
                <p className="text-gray-400">Check back later for fixtures</p>
              </div>
            ) : (
              currentData.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  showCompetition={activeTab !== 'upcoming'} 
                />
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-xs text-gray-400">
          <p>Data provided by football-data.org • Updates every 10 minutes</p>
          <p className="mt-1">
            {Object.keys(competitions).length} competitions available • 
            {currentData.length} {activeTab} matches
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpcomingMatches;