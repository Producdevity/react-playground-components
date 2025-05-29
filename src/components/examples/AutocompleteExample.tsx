import { useState, useMemo, useEffect } from 'react'
import Autocomplete, { AutocompleteOptionType } from '@/components/Autocomplete'

function AutocompleteExample() {
  const [notification, setNotification] = useState<string | null>(null)

  const staticFruitsData: AutocompleteOptionType[] = useMemo(
    () => [
      { id: 'f1', value: 'Apple', label: '🍎 Apple' },
      { id: 'f2', value: 'Banana', label: '🍌 Banana' },
      { id: 'f3', value: 'Orange', label: '🍊 Orange' },
      { id: 'f4', value: 'Grape', label: '🍇 Grape' },
      { id: 'f5', value: 'Mango', label: '🥭 Mango' },
      { id: 'f6', value: 'Strawberry', label: '🍓 Strawberry' },
    ],
    [],
  )

  const [dynamicFruits, setDynamicFruits] =
    useState<AutocompleteOptionType[]>(staticFruitsData)

  const ajaxCountriesData: AutocompleteOptionType[] = useMemo(
    () => [
      {
        id: 'c1',
        value: 'United States',
        label: '🇺🇸 United States of America',
      },
      { id: 'c2', value: 'Canada', label: '🇨🇦 Canada' },
      { id: 'c3', value: 'United Kingdom', label: '🇬🇧 United Kingdom' },
      { id: 'c4', value: 'Germany', label: '🇩🇪 Germany' },
    ],
    [],
  )
  const [dynamicCountries, setDynamicCountries] =
    useState<AutocompleteOptionType[]>(ajaxCountriesData)

  const handleFruitSelect = (
    item: AutocompleteOptionType | null,
    value: string,
  ) => {
    setNotification(
      item ? `Selected fruit: ${item.label}` : `Input value: ${value}`,
    )
  }

  const handleFruitCreate = (query: string) => {
    const newFruit: AutocompleteOptionType = {
      id: `new-${Date.now()}`,
      value: query,
      label: `🆕 ${query}`,
    }
    setDynamicFruits((prev) => [...prev, newFruit])
    setNotification(`Fruit "${query}" created and added to list (simulated).`)
  }

  const fetchCountriesData = async (
    query: string,
  ): Promise<AutocompleteOptionType[]> => {
    setNotification(`Fetching countries for: ${query}...`)
    await new Promise((resolve) =>
      setTimeout(resolve, 700 + Math.random() * 500),
    )
    const lowerQuery = query.toLowerCase()
    const filtered = dynamicCountries.filter(
      (country) =>
        country.value.toLowerCase().includes(lowerQuery) ||
        country.label.toLowerCase().includes(lowerQuery),
    )
    setNotification(null)
    return filtered
  }

  const handleCountrySelect = (
    item: AutocompleteOptionType | null,
    value: string,
  ) => {
    setNotification(
      item ? `Selected country: ${item.label}` : `Input value: ${value}`,
    )
  }

  const handleCountryCreate = (query: string) => {
    const newCountry: AutocompleteOptionType = {
      id: `new-${Date.now()}`,
      value: query,
      label: `🏳️ ${query}`,
    }
    setDynamicCountries((prev) => [...prev, newCountry])
    setNotification(
      `Country "${query}" created (simulated, would be API call).`,
    )
  }

  const renderFruitItem = (item: AutocompleteOptionType): React.ReactNode => (
    <div className="flex items-center space-x-3">
      <span className="text-xl">{item.label.split(' ')[0]}</span>
      <span>{item.label.substring(item.label.indexOf(' ') + 1)}</span>
    </div>
  )

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  return (
    <>

      <div className="bg-slate-100 min-h-screen flex flex-col items-center justify-center p-6 space-y-8">
        {notification && (
          <div className="fixed top-5 right-5 bg-blue-500 text-white py-2 px-4 rounded-md shadow-lg transition-opacity duration-300 animate-fadeInOut">
            {notification}
          </div>
        )}
        <style>{``}</style>

        <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl">
          <Autocomplete
            id="static-fruit-search"
            label="Search Fruits (Static Data)"
            placeholder="E.g., Apple, Banana..."
            staticData={dynamicFruits}
            onSelect={handleFruitSelect}
            onCreate={handleFruitCreate}
            renderItem={renderFruitItem}
            minChars={1}
          />
          <p className="mt-2 text-xs text-gray-500">
            Try: Apple, Orange, Grape, Mango. New items are added to the list.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl">
          <Autocomplete
            id="ajax-country-search"
            label="Search Countries (Simulated AJAX)"
            placeholder="E.g., United, Canada..."
            fetchData={fetchCountriesData}
            onSelect={handleCountrySelect}
            onCreate={handleCountryCreate}
            renderItem={(item) => (
              <div className="flex items-center space-x-2">
                <span>{item.label.split(' ')[0]}</span>
                <span>{item.label.substring(item.label.indexOf(' ') + 1)}</span>
              </div>
            )}
            minChars={2}
          />
          <p className="mt-2 text-xs text-gray-500">
            Simulates network delay. Try: United, Canada, Germany. New items are
            added to the list.
          </p>
        </div>
      </div>
    </>
  )
}

export default AutocompleteExample
