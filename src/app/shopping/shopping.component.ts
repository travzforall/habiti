import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface ShoppingItem {
  id: string;
  query: string;
  results: ProductResult[];
  dateAdded: Date;
}

interface ProductResult {
  store: 'amazon' | 'walmart' | 'ebay';
  title: string;
  price: string;
  url: string;
  image?: string;
  rating?: string;
}

@Component({
  selector: 'app-shopping',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shopping.component.html',
  styleUrl: './shopping.component.scss'
})
export class ShoppingComponent implements OnInit {
  shoppingItems: ShoppingItem[] = [];
  searchQuery: string = '';
  isSearching: boolean = false;

  ngOnInit() {
    this.loadShoppingItems();
  }

  loadShoppingItems() {
    const stored = localStorage.getItem('shoppingItems');
    if (stored) {
      this.shoppingItems = JSON.parse(stored).map((item: any) => ({
        ...item,
        dateAdded: new Date(item.dateAdded)
      }));
    }
  }

  saveShoppingItems() {
    localStorage.setItem('shoppingItems', JSON.stringify(this.shoppingItems));
  }

  async searchProducts() {
    if (!this.searchQuery.trim()) return;

    this.isSearching = true;

    try {
      const results: ProductResult[] = [];
      
      // Simulate API calls to different stores
      const amazonResults = await this.searchAmazon(this.searchQuery);
      const walmartResults = await this.searchWalmart(this.searchQuery);
      const ebayResults = await this.searchEbay(this.searchQuery);

      results.push(...amazonResults, ...walmartResults, ...ebayResults);

      const shoppingItem: ShoppingItem = {
        id: Date.now().toString(),
        query: this.searchQuery,
        results: results,
        dateAdded: new Date()
      };

      this.shoppingItems.unshift(shoppingItem);
      this.saveShoppingItems();
      this.searchQuery = '';

    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again.');
    } finally {
      this.isSearching = false;
    }
  }

  // Mock search functions - replace with actual API calls
  private async searchAmazon(query: string): Promise<ProductResult[]> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return [
      {
        store: 'amazon',
        title: `${query} - Amazon Choice`,
        price: '$' + (Math.random() * 100 + 10).toFixed(2),
        url: `https://amazon.com/s?k=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=Amazon',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      },
      {
        store: 'amazon',
        title: `Premium ${query}`,
        price: '$' + (Math.random() * 200 + 50).toFixed(2),
        url: `https://amazon.com/s?k=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=Amazon',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      }
    ];
  }

  private async searchWalmart(query: string): Promise<ProductResult[]> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return [
      {
        store: 'walmart',
        title: `${query} - Great Value`,
        price: '$' + (Math.random() * 80 + 5).toFixed(2),
        url: `https://walmart.com/search/?query=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=Walmart',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      },
      {
        store: 'walmart',
        title: `${query} - Everyday Low Price`,
        price: '$' + (Math.random() * 60 + 8).toFixed(2),
        url: `https://walmart.com/search/?query=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=Walmart',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      }
    ];
  }

  private async searchEbay(query: string): Promise<ProductResult[]> {
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    return [
      {
        store: 'ebay',
        title: `${query} - Auction Style`,
        price: '$' + (Math.random() * 150 + 15).toFixed(2),
        url: `https://ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=eBay',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      },
      {
        store: 'ebay',
        title: `Used ${query} - Good Condition`,
        price: '$' + (Math.random() * 90 + 12).toFixed(2),
        url: `https://ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
        image: 'https://via.placeholder.com/150x150?text=eBay',
        rating: '⭐'.repeat(Math.floor(Math.random() * 5) + 1)
      }
    ];
  }

  deleteShoppingItem(itemId: string) {
    this.shoppingItems = this.shoppingItems.filter(item => item.id !== itemId);
    this.saveShoppingItems();
  }

  openProductLink(url: string) {
    window.open(url, '_blank');
  }

  getStoreColor(store: string): string {
    switch (store) {
      case 'amazon': return 'bg-orange-500';
      case 'walmart': return 'bg-blue-500';
      case 'ebay': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  }

  getStoreIcon(store: string): string {
    switch (store) {
      case 'amazon': return '📦';
      case 'walmart': return '🏪';
      case 'ebay': return '🏷️';
      default: return '🛒';
    }
  }
}