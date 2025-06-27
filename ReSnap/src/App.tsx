import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, History } from "lucide-react";
import EbayCarousel from "./Carousel";

export default function HomeScreen() {
  const [searchTerm, setSearchTerm] = useState("");
  const [condition, setCondition] = useState("New");
  type HistoryEntry = { type: "image"; value: string; caption?: string; saved?: boolean };
  const [modalEntry, setModalEntry] = useState<HistoryEntry | null>(null);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const carouselItems = [
    {
      image: "./Images/Controller.webp",
      title: "Xbox One Wireless Controller",
      price: { value: "20-35", currency: "USD" }
    },
    {
      image: "./Images/Jansport.jpg",
      title: "Jansport Backpack (Used)",
      price: { value: "15-35", currency: "USD" }
    },
    {
      image: "./Images/DS4.jpg",
      title: "Sony DualShock 4 Controller (Used)",
      price: { value: "20-35", currency: "USD" }
    },
    {
      image: "./Images/IPhoneSE.jpg",
      title: "IPhone SE (Used)",
      price: { value: "54.99-174.99", currency: "USD" }
    },
    {
      image: "./Images/DS5.jpg",
      title: "Sony Dualsense Cosmic Red Controller",
      price: { value: "40-55", currency: "USD" }
    },
    {
      image: "./Images/Printer.jpg",
      title: "HP Color LaserJet CP 2025 Printer (Used)",
      price: { value: "150-250", currency: "USD" }
    }
  ];

  const minSavedValue = useMemo(() => {
    // Helper to extract lower bound from price string
    const getLowerBound = (caption?: string) => {
      if (!caption) return null;
      // Find all " - " occurrences
      const dashIndexes = [];
      let idx = caption.indexOf(" - ");
      while (idx !== -1) {
        dashIndexes.push(idx);
        idx = caption.indexOf(" - ", idx + 1);
      }
      let priceStr = "";
      if (dashIndexes.length >= 2) {
        const splitIdx = dashIndexes[dashIndexes.length - 2];
        priceStr = caption.slice(splitIdx + 3).trim();
      } else if (dashIndexes.length === 1) {
        const splitIdx = dashIndexes[0];
        priceStr = caption.slice(splitIdx + 3).trim();
      } else {
        priceStr = caption.trim();
      }
      // Extract lower bound number (e.g. "$12-20", "$12", "Could not find price range")
      const match = priceStr.match(/\$?([\d,]+(\.\d+)?)/);
      if (!match || priceStr.toLowerCase().includes("unknown") || priceStr.toLowerCase().includes("could not find")) return null;
      return parseFloat(match[1].replace(/,/g, ""));
    };

    const savedItems = history.filter(item => item.saved);
    const minValue = savedItems
      .map(item => getLowerBound(item.caption))
      .filter(v => v !== null)
      .reduce((sum, v) => sum + (v as number), 0);
    return isFinite(minValue) ? minValue : null;
  }, [history]);

  const handleTextSearch = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Add loading card
      setHistory(prev => {
        const newEntry: HistoryEntry = {
          type: "image",
          value: "", // No image yet
          caption: "⏳ Searching..."
        };
        return [newEntry, ...prev];
      });
      const cardIndex = 0;

      try {
        // Call the new ebay-search endpoint
        const response = await fetch('http://localhost:3001/ebay-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchTerm,
            condition
          }),
        });
        const data = await response.json();
        console.log("eBay search response:", data);

        // Extract price values, filter out invalids
        let prices = (data.items || [])
          .map((item: { price: { value: any; }; }) => Number(item.price?.value))
          .filter((v: number) => !isNaN(v) && v > 0);

        // Exclude outliers using interquartile range (IQR) method if enough prices
        if (prices.length >= 4) {
          prices.sort((a: number, b: number) => a - b);
          const q1 = prices[Math.floor((prices.length / 4))];
          const q3 = prices[Math.ceil((prices.length * (3 / 4))) - 1];
          const iqr = q3 - q1;
          const lower = q1 - 1.5 * iqr;
          const upper = q3 + 1.5 * iqr;
          prices = prices.filter((p: number) => p >= lower && p <= upper);
        }

        let priceRange = "No prices found";
        if (prices.length > 0) {
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          priceRange = min === max
            ? `$${min}`
            : `$${min}-${max}`;
        }

        // Use the first item's image if available
        const thumbnail = data.items && data.items[0] && data.items[0].image
          ? data.items[0].image
          : "";

        setHistory(prev => {
          const updated = [...prev];
          if (updated[cardIndex]) {
            updated[cardIndex] = {
              ...updated[cardIndex],
              value: thumbnail,
              caption: `${searchTerm} (${condition}) - ${priceRange}`
            };
            setModalEntry(updated[cardIndex]);
          }
          return updated;
        });
      } catch (err) {
        setHistory(prev => {
          const updated = [...prev];
          if (updated[cardIndex]) {
            updated[cardIndex] = {
              ...updated[cardIndex],
              caption: "❌ Error fetching price"
            };
          }
          return updated;
        });
        console.error('Error calling ebay-search API:', err);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const imageUrl = URL.createObjectURL(file);

      // Add loading card with image
      setHistory(prev => [
        {
          type: "image",
          value: imageUrl,
          caption: "⏳ Searching..."
        },
        ...prev
      ]);
      const cardIndex = 0; // Always at the top

      // Get caption from image
      const itemName = await simulateImageRecognition(file);

      // Get price from pricecheck API
      try {
        // Only call the ebay-search API (no pricecheck)
        const ebayResponse = await fetch('http://localhost:3001/ebay-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchTerm: itemName,
            condition
          }),
        });

        const ebayData = await ebayResponse.json();

        // Extract price range from ebayData
        let ebayPriceRange = "";
        let prices = (ebayData.items || [])
          .map((item: { price: { value: any } }) => Number(item.price?.value))
          .filter((v: number) => !isNaN(v) && v > 0);

        // Exclude outliers using IQR if enough prices
        if (prices.length >= 4) {
          prices.sort((a: number, b: number) => a - b);
          const q1 = prices[Math.floor((prices.length / 4))];
          const q3 = prices[Math.ceil((prices.length * (3 / 4))) - 1];
          const iqr = q3 - q1;
          const lower = q1 - 1.5 * iqr;
          const upper = q3 + 1.5 * iqr;
          prices = prices.filter((p: number) => p >= lower && p <= upper);
        }

        if (prices.length > 0) {
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          ebayPriceRange = min === max ? `$${min}` : `$${min}-${max}`;
        } else {
          ebayPriceRange = "No prices found";
        }

        const finalPrice = ebayPriceRange;
        // Update the loading card with the result
        setHistory(prev => {
          const updated = [...prev];
          if (updated[cardIndex]) {
            updated[cardIndex] = {
              ...updated[cardIndex],
              caption: `${itemName} (${condition}) - ${ebayPriceRange}`
            };
            setModalEntry(updated[cardIndex]); // Show modal
          }
          return updated;
        });
      } catch (err) {
        setHistory(prev => {
          const updated = [...prev];
          if (updated[cardIndex]) {
            updated[cardIndex] = {
              ...updated[cardIndex],
              caption: "❌ Error fetching price"
            };
          }
          return updated;
        });
        console.error('Error calling pricecheck API:', err);
      }
    }
  };

  const simulateImageRecognition = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:3001/caption', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to get caption');
      }
      const data = await response.json();
      return data.caption || "Unknown item";
    } catch (err) {
      console.error('Error calling proxy server:', err);
      return "Unknown item";
    }
  };

  const handleSave = (index: number) => {
    setHistory(prev => {
      const updated = prev.map((item, i) =>
        i === index ? { ...item, saved: true } : item
      );
      return updated;
    });
    // Update modalEntry if it's the same item
    if (
      modalEntry &&
      history[index] &&
      modalEntry.caption === history[index].caption &&
      modalEntry.value === history[index].value
    ) {
      setModalEntry({ ...modalEntry, saved: true });
    }
  };

  return (
    <div className="flex start min-h-screen bg-blue-80 font-sans">
      <div className="flex flex-col justify-start min-h-screen p-10 max-w-lg mx-auto">
        {/* Saved Items Button and Value Label */}
        <div className="flex flex-col items-start mb-4 ">
          <button
            className="bg-green-500 text-white px-3 py-1 rounded shadow hover:bg-green-400"
            onClick={() => setShowSavedModal(true)}
          >
            Saved Items
          </button>
          {history.filter(item => item.saved).length === 0 ? (
            <div className="mt-2 text-green-900 text-sm font-medium mb-8">
              No saved items
            </div>
          ) : (
            minSavedValue !== null && minSavedValue > 0 && (
              <div className="mt-2 text-green-900 text-sm font-medium mb-8">
                {history.filter(item => item.saved).length} item(s) worth ${minSavedValue}!
              </div>
            )
          )}
        </div>

        <h1
          className="text-5xl font-bold text-blue-600 text-center mb-3 text-outline"
        >
          <label className="text-gray-600"
            style={{
              textDecoration: "underline",
              textDecorationColor: "#acacd3",
              textUnderlineOffset: "4px",
              textDecorationThickness: "1px"
            }}
          >Re</label>Snap 📸
        </h1>
        <h2 className="text-lg text-blue-400 text-center mb-4 mt-[-0.5rem]">"How much is my junk worth?"</h2>
        <div className="space-y-4">
          {/* Text Search */}
          <form className="w-full relative" onSubmit={handleTextSearch}>
            <Input
              className="h-14 text-lg pr-20 rounded-full w-full shadow-sm"
              placeholder="Search for an item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* <label className="absolute right-3 top-1/2 -translate-y-8 cursor-pointer">
              <ImageIcon className="w-6 h-6 text-gray-400 hover:text-blue-600" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label> */}
            {/* Condition Dropdown under the search bar */}
            <div className="flex gap-4 mt-3 ml-1">
              <label className="flex items-center gap-1 text-sm">
                Condition:
                <select
                  className="ml-2 border rounded px-2 py-1"
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="Open box">Open box</option>
                  <option value="Used">Used</option>
                  <option value="Broken">Broken</option>
                  <option value="For parts or not working">For parts or not working</option>
                </select>
              </label>
            </div>
          </form>

          {/* Image Upload Button with dotted outline */}
          <div className="mt-4 ml-1">
            <label className="flex flex-col items-center justify-center border-2 border-dotted border-blue-400 rounded px-4 py-2 cursor-pointer hover:bg-blue-50 transition">
              <span className="flex items-center justify-center mb-2">
                <ImageIcon className="w-8 h-8 text-blue-600" />
              </span>
              <span className="text-blue-600 font-medium mb-1">Take a photo</span>
              <span className="text-xs text-gray-500 mb-2">or upload an image</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Call to Action about Reselling */}
          <div className="mb-6 px-2 py-1 bg-green-50 border border-green-200 rounded-lg text-green-900 text-base font-semibold text-center">
            🌎 <span className="font-bold">Reselling your items helps the planet!</span> By giving your unused items a second life, you reduce the need for manufacturing new products, lower emissions, and save valuable resources. Every item resold is one less in a landfill and one step closer to a more sustainable future.
          </div>
          {/* Carousel Section */}
          <div className="w-full flex justify-start">
            <div className="w-full max-w-[300px]">
              <h1 className="mt-0 text-green-800 text-lg font-bold mb-2">Featured Items:</h1>
              <EbayCarousel items={carouselItems} />
            </div>
          </div>
          {/* History Section */}
          {history.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2 flex items-center">
                <History className="w-5 h-5 mr-2" /> Previous Items
              </h2>
              <div className="space-y-2">
                {history.map((entry, index) => {
                  let title = "";
                  let price = "";
                  if (entry.caption) {
                    // Find all " - " occurrences
                    const dashIndexes = [];
                    let idx = entry.caption.indexOf(" - ");
                    while (idx !== -1) {
                      dashIndexes.push(idx);
                      idx = entry.caption.indexOf(" - ", idx + 1);
                    }
                    if (dashIndexes.length >= 2) {
                      // Split at the second-to-last dash
                      const splitIdx = dashIndexes[dashIndexes.length - 2];
                      title = entry.caption.slice(0, splitIdx);
                      price = entry.caption.slice(splitIdx + 3);
                    } else if (dashIndexes.length === 1) {
                      // Only one dash, split there
                      const splitIdx = dashIndexes[0];
                      title = entry.caption.slice(0, splitIdx);
                      price = entry.caption.slice(splitIdx + 3);
                    } else {
                      title = entry.caption;
                    }
                  }

                  return (
                    <Card key={index}>
                      <CardContent className="p-3 flex items-center gap-3 max-w-full">
                        <img
                          src={entry.value || "/placeholder.png"}
                          alt="scanned item"
                          className="w-12 h-12 object-contain rounded bg-white flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 flex flex-col break-words max-w-[60vw]">
                          {entry.caption ? (
                            <>
                              <span>{`🔍 ${title}`}</span>
                              {price && (
                                <span className="text-xs text-green-600 mt-1">{price}</span>
                              )}
                            </>
                          ) : (
                            "⏳ Searching..."
                          )}
                        </span>
                        <button
                          className={`ml-2 px-2 py-1 rounded text-xs ${entry.saved ? "bg-green-200 text-green-800 cursor-default" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}
                          disabled={entry.saved}
                          onClick={() => handleSave(index)}
                        >
                          {entry.saved ? "Saved" : "Save"}
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          {/* Modal for displaying detailed scan result */}
          {modalEntry && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[320px] max-w-[95vw] max-h-[80vh] flex flex-col">
                <div className="flex flex-col items-center">
                  <img
                    src={modalEntry.value || "/placeholder.png"}
                    alt="scanned item"
                    className="w-24 h-24 object-contain rounded bg-gray-100 mb-4"
                  />
                  <div className="text-lg font-semibold mb-2 text-center">
                    {(() => {
                      if (!modalEntry.caption) return "";
                      const firstDash = modalEntry.caption.indexOf(" - ");
                      if (firstDash === -1) return modalEntry.caption;
                      return modalEntry.caption.slice(0, firstDash);
                    })()}
                  </div>
                  <div className="text-green-600 text-sm mb-4 text-center">
                    {/* Call to Action */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 text-blue-900 text-sm text-center max-w-md">
                      <span className="font-semibold">Ready to give your item a second life?</span>
                      <br />
                      If the price looks good, consider listing your item on eBay, Facebook Marketplace, or a local selling app. Take clear photos, write a detailed description, and set a fair price to attract buyers.
                      <br /><br />
                      <span className="font-semibold">Not satisfied with the offer?</span>
                      <br />
                      Donating your item is a great way to help others and keep usable goods out of landfills. Many charities and thrift stores accept donations, and you may even qualify for a tax deduction!
                    </div>
                    <label className="font-bold text-lg">
                      {(() => {
                        if (!modalEntry.caption) return "";
                        const firstDash = modalEntry.caption.indexOf(" - ");
                        if (firstDash === -1) return "";
                        const priceStr = modalEntry.caption.slice(firstDash + 3);
                        return (
                          <>
                            {priceStr}
                          </>
                        );
                      })()}
                    </label>
                  </div>
                  <div className="flex flex-row gap-3 mt-2">
                    <button
                      className={`px-4 py-2 rounded ${modalEntry.saved ? "bg-green-200 text-green-800 cursor-default" : "bg-blue-400 text-white hover:bg-blue-700"}`}
                      disabled={modalEntry.saved}
                      onClick={() => {
                        // Find the matching history entry and save it
                        const idx = history.findIndex(
                          h => h.caption === modalEntry.caption && h.value === modalEntry.value
                        );
                        if (idx !== -1) handleSave(idx);
                        setModalEntry({ ...modalEntry, saved: true });
                      }}
                    >
                      {modalEntry.saved ? "Saved" : "Save"}
                    </button>
                    <button
                      className="px-4 py-2 bg-blue-400 text-white rounded hover:bg-blue-700"
                      onClick={() => setModalEntry(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Saved Items Modal */}
          {showSavedModal && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[320px] max-w-[95vw] max-h-[80vh] flex flex-col">
                <div className="text-xl font-bold mb-4 text-center">Saved Items</div>
                <div className="text-base font-semibold mb-2 text-center text-green-700">
                  {minSavedValue !== null
                    ? <>Minimum value of saved items: <span className="font-bold">${minSavedValue}</span></>
                    : "No valid prices found in saved items."}
                </div>
                <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                  {history.filter(item => item.saved).length === 0 && (
                    <div className="text-gray-500 text-center">No saved items yet.</div>
                  )}
                  {history.filter(item => item.saved).map((entry, idx) => {
                    let title = "";
                    let price = "";
                    if (entry.caption) {
                      const dashIndexes = [];
                      let i = entry.caption.indexOf(" - ");
                      while (i !== -1) {
                        dashIndexes.push(i);
                        i = entry.caption.indexOf(" - ", i + 1);
                      }
                      if (dashIndexes.length >= 2) {
                        const splitIdx = dashIndexes[dashIndexes.length - 2];
                        title = entry.caption.slice(0, splitIdx);
                        price = entry.caption.slice(splitIdx + 3);
                      } else if (dashIndexes.length === 1) {
                        const splitIdx = dashIndexes[0];
                        title = entry.caption.slice(0, splitIdx);
                        price = entry.caption.slice(splitIdx + 3);
                      } else {
                        title = entry.caption;
                      }
                    }
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded p-2">
                        <img
                          src={entry.value || "/placeholder.png"}
                          alt="saved item"
                          className="w-10 h-10 object-contain rounded bg-white"
                        />
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-medium">{title}</span>
                          {price && <span className="text-xs text-green-600">{price}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => setShowSavedModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
