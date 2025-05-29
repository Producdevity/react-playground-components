import './Autocomplete.css'
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import useDebounce from '@/hooks/useDebounce'
import defaultFilterItem from './utils/defaultFilterItem'

export interface AutocompleteOptionType
  extends Record<string, string | number | boolean> {
  id: string | number
  value: string
  label: string
}

interface Props {
  id: string
  label: string
  placeholder?: string
  staticData?: AutocompleteOptionType[]
  fetchData?: (query: string) => Promise<AutocompleteOptionType[]>
  onSelect: (
    item: AutocompleteOptionType | null,
    inputElementValue: string,
  ) => void
  onCreate: (query: string) => void
  renderItem?: (item: AutocompleteOptionType) => ReactNode
  filterItem?: (item: AutocompleteOptionType, query: string) => boolean
  createButtonText?: (query: string) => string
  minChars?: number
  debounceDelay?: number
  styles?: {
    container?: string
    input?: string
    resultsList?: string
    resultItem?: string
    createButton?: string
  }
}

function Autocomplete({
  id,
  label,
  placeholder,
  staticData,
  fetchData,
  onSelect,
  onCreate,
  renderItem: customRenderItem,
  filterItem: customFilterItem,
  createButtonText: customCreateButtonText,
  minChars = 1,
  debounceDelay = 300,
  styles = {},
}: Props) {
  const [query, setQuery] = useState('')
  const [currentResults, setCurrentResults] = useState<
    AutocompleteOptionType[]
  >([])
  const [animatingOutItems, setAnimatingOutItems] = useState<
    Record<string | number, AutocompleteOptionType>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [isResultsVisible, setIsResultsVisible] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsListRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const justSelectedRef = useRef(false) // To prevent focus from re-opening list immediately after selection

  const debouncedQuery = useDebounce(query, debounceDelay)

  const defaultRenderItem = (item: AutocompleteOptionType): ReactNode => (
    <div>{item.label || item.value}</div>
  )
  const renderItem = customRenderItem || defaultRenderItem

  const filterItem = customFilterItem || defaultFilterItem

  const defaultCreateButtonText = (currentQuery: string): string =>
    `Create "${currentQuery}"`
  const createButtonText = customCreateButtonText || defaultCreateButtonText

  // Effect for fetching/filtering data based on debounced query
  useEffect(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }

    if (debouncedQuery.length < minChars) {
      if (currentResults.length > 0) {
        setAnimatingOutItems((prev) => {
          const newAnimatingOut = { ...prev }
          currentResults.forEach((item) => {
            newAnimatingOut[item.id] = item
          })
          return newAnimatingOut
        })
        // Schedule cleanup for these items after their animation
        animationTimeoutRef.current = setTimeout(
          () => setAnimatingOutItems({}),
          300,
        )
      }
      setCurrentResults([])
      setIsLoading(false)
      if (isResultsVisible) {
        // Only change visibility if it's currently visible
        setIsResultsVisible(false)
      }
      return
    }

    const getResults = async () => {
      setIsLoading(true)
      const oldResultsToAnimateOut = { ...animatingOutItems }
      currentResults.forEach((item) => {
        oldResultsToAnimateOut[item.id] = item
      })
      setAnimatingOutItems(oldResultsToAnimateOut)

      let newResultsData: AutocompleteOptionType[] = []
      try {
        if (fetchData) {
          newResultsData = await fetchData(debouncedQuery)
        } else if (staticData) {
          newResultsData = staticData.filter((item) =>
            filterItem(item, debouncedQuery),
          )
        }
      } catch (error) {
        console.error('Error fetching autocomplete data:', error)
      }

      setCurrentResults(newResultsData)
      setIsLoading(false)
      setActiveIndex(-1)

      setAnimatingOutItems((prev) => {
        const stillAnimating = { ...prev }
        newResultsData.forEach((newItem) => {
          delete stillAnimating[newItem.id]
        })
        return stillAnimating
      })

      animationTimeoutRef.current = setTimeout(
        () => setAnimatingOutItems({}),
        300,
      )

      const shouldShowList =
        newResultsData.length > 0 ||
        (debouncedQuery.length >= minChars &&
          newResultsData.length === 0 &&
          !isLoading) // Potential create button
      if (shouldShowList) {
        if (!isResultsVisible) setIsResultsVisible(true)
      } else {
        if (isResultsVisible) setIsResultsVisible(false)
      }
    }

    getResults()

    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, minChars, fetchData, staticData, filterItem]) // isResultsVisible removed to avoid loops

  // Effect for handling clicks outside the component to close the results list
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isResultsVisible) setIsResultsVisible(false) // Only update if it's visible
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isResultsVisible]) // Add isResultsVisible to dependencies

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value
    setQuery(newQuery)
    // Visibility is primarily handled by the debouncedQuery effect and focus handler
    // but if user types and minChars is met, we can preemptively show.
    if (newQuery.length >= minChars && !isResultsVisible) {
      // Check if there would be results or create button
      const potentialResults =
        staticData?.filter((item) => filterItem(item, newQuery)) || []
      const canShowCreate =
        newQuery.length >= minChars &&
        potentialResults.length === 0 &&
        !isLoading
      if (potentialResults.length > 0 || canShowCreate) {
        setIsResultsVisible(true)
      }
    } else if (newQuery.length < minChars && isResultsVisible) {
      setIsResultsVisible(false) // Hide immediately if query becomes too short
    }
  }

  const handleItemClick = (item: AutocompleteOptionType) => {
    setQuery(item.value)
    onSelect(item, item.value)
    setIsResultsVisible(false)
    setActiveIndex(-1)
    justSelectedRef.current = true // Flag that a selection happened via click
    // inputRef.current?.focus(); // Re-focusing can be good UX, but need to handle justSelectedRef in onFocus
  }

  const handleCreateClick = () => {
    if (query) {
      onCreate(query)
      setQuery('')
      setCurrentResults([])
      setAnimatingOutItems({})
      setIsResultsVisible(false)
      setActiveIndex(-1)
    }
  }

  const handleInputFocus = () => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false // Reset flag and prevent re-opening
      return
    }
    // Show if query is valid and (there are results OR it's a potential create scenario)
    const canShowCreateButton =
      query.length >= minChars &&
      currentResults.length === 0 &&
      Object.keys(animatingOutItems).length === 0 &&
      !isLoading
    if (
      query.length >= minChars &&
      (currentResults.length > 0 || canShowCreateButton)
    ) {
      console.log('Input focused, showing results')
      if (!isResultsVisible) setIsResultsVisible(true)
    }
  }

  const showCreateButton =
    isResultsVisible &&
    query.length >= minChars &&
    currentResults.length === 0 &&
    Object.keys(animatingOutItems).length === 0 &&
    !isLoading

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const itemsToNavigate = currentResults

    if (!isResultsVisible) {
      // If list is not visible, ArrowDown/Up should open it if conditions are met
      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        query.length >= minChars
      ) {
        // Check if there are actual items or if a create button would be shown
        const canShowCreate =
          itemsToNavigate.length === 0 &&
          Object.keys(animatingOutItems).length === 0 &&
          !isLoading
        if (itemsToNavigate.length > 0 || canShowCreate) {
          event.preventDefault()
          setIsResultsVisible(true)
          if (itemsToNavigate.length > 0) {
            setActiveIndex(
              event.key === 'ArrowDown' ? 0 : itemsToNavigate.length - 1,
            )
          } else {
            setActiveIndex(-1) // No items to make active, but list (for create btn) opens
          }
        }
      }
      // For any other key, if list is not visible, do nothing (e.g. allow typing)
      // Escape is implicitly handled by doing nothing if list not visible
      return // Important: if list was not made visible, subsequent logic is for visible list
    }

    // From here, isResultsVisible is true
    if (itemsToNavigate.length === 0) {
      // List is visible, but no items (only create button is possible)
      if (event.key === 'Enter' && showCreateButton) {
        event.preventDefault()
        handleCreateClick()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setIsResultsVisible(false)
        setActiveIndex(-1)
      }
      // Arrows do nothing if no items
      return
    }

    // List is visible and has items
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((prevIndex) => (prevIndex + 1) % itemsToNavigate.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex(
          (prevIndex) =>
            (prevIndex - 1 + itemsToNavigate.length) % itemsToNavigate.length,
        )
        break
      case 'Enter':
        event.preventDefault()
        if (activeIndex >= 0 && activeIndex < itemsToNavigate.length) {
          // `handleItemClick` will set justSelectedRef.current = true
          handleItemClick(itemsToNavigate[activeIndex])
        } else if (showCreateButton) {
          // Fallback if somehow activeIndex is -1 but create is an option
          handleCreateClick()
        }
        break
      case 'Escape':
        event.preventDefault()
        setIsResultsVisible(false)
        setActiveIndex(-1)
        break
      case 'Tab':
        setIsResultsVisible(false) // Close list on Tab
        setActiveIndex(-1)
        // Default browser behavior will move focus
        break
    }
  }

  // Effect to scroll the active item into view
  useEffect(() => {
    if (
      activeIndex >= 0 &&
      resultsListRef.current &&
      currentResults[activeIndex]
    ) {
      const activeElement = resultsListRef.current.querySelector(
        `#${id}-result-${currentResults[activeIndex].id}`,
      )
      activeElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, id, currentResults])

  // Memoized list of items for rendering, including animation states
  const itemsToDisplayForAnimation = useMemo(() => {
    const displayMap = new Map<
      string | number,
      AutocompleteOptionType & {
        animationState: 'entering' | 'exiting' | 'stable'
      }
    >()
    Object.values(animatingOutItems).forEach((item) => {
      if (!currentResults.find((cr) => cr.id === item.id)) {
        displayMap.set(item.id, { ...item, animationState: 'exiting' })
      }
    })
    currentResults.forEach((item) => {
      const wasAnimatingOut =
        animatingOutItems[item.id] && !displayMap.has(item.id) // Ensure it's not already marked for exit
      displayMap.set(item.id, {
        ...item,
        animationState: wasAnimatingOut ? 'stable' : 'entering',
      })
    })
    return Array.from(displayMap.values()).sort((a, b) => {
      // Ensure exiting items are rendered, then entering/stable
      if (a.animationState === 'exiting' && b.animationState !== 'exiting')
        return -1
      if (a.animationState !== 'exiting' && b.animationState === 'exiting')
        return 1
      // Further sort by original order if needed, but map iteration order is usually fine for currentResults
      return 0
    })
  }, [currentResults, animatingOutItems])

  return (
    <div
      ref={containerRef}
      className={`autocomplete-container ${styles.container || ''}`}
    >
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          className={`autocomplete-input w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow ${styles.input || ''}`}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isResultsVisible}
          aria-controls={`${id}-results-list`}
          aria-activedescendant={
            activeIndex >= 0 && currentResults[activeIndex]
              ? `${id}-result-${currentResults[activeIndex].id}`
              : undefined
          }
        />
        {isLoading && (
          <div className="autocomplete-loader visible">
            <div className="loader-dot animate-pulse-scale" />
            <div className="loader-dot animate-pulse-scale" />
            <div className="loader-dot animate-pulse-scale" />
          </div>
        )}
      </div>

      <div
        ref={resultsListRef}
        id={`${id}-results-list`}
        role="listbox"
        className={`autocomplete-results ${isResultsVisible ? 'visible' : ''} ${styles.resultsList || ''}`}
      >
        {itemsToDisplayForAnimation.map((item) => (
          <div
            key={item.id}
            id={`${id}-result-${item.id}`}
            role="option"
            aria-selected={currentResults[activeIndex]?.id === item.id}
            className={`autocomplete-result-item 
              ${(item.animationState === 'entering' || item.animationState === 'stable') && !animatingOutItems[item.id] ? 'item-visible' : ''}
              ${item.animationState === 'exiting' || animatingOutItems[item.id] ? 'exiting' : ''}
              ${currentResults[activeIndex]?.id === item.id ? 'active' : ''}
              ${styles.resultItem || ''}`}
            style={{
              transitionDelay:
                item.animationState === 'entering' &&
                !animatingOutItems[item.id]
                  ? `${currentResults.findIndex((cr) => cr.id === item.id) * 50}ms`
                  : '0ms',
            }} // Stagger based on index in currentResults for entering items
            onClick={() => handleItemClick(item)}
            onMouseEnter={() => {
              if (item.animationState !== 'exiting') {
                // Don't highlight exiting items
                const itemIndexInCurrentResults = currentResults.findIndex(
                  (cr) => cr.id === item.id,
                )
                if (itemIndexInCurrentResults !== -1) {
                  setActiveIndex(itemIndexInCurrentResults)
                }
              }
            }}
          >
            {renderItem(item)}
          </div>
        ))}

        {showCreateButton && (
          <div
            className={`autocomplete-create-button-container ${showCreateButton ? 'visible' : ''}`}
          >
            <button
              type="button"
              className={`create-item-button ${styles.createButton || ''}`}
              onClick={handleCreateClick}
            >
              {createButtonText(query)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Autocomplete
