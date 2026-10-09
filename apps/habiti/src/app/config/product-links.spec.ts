import { readProductLink } from './product-links';

describe('reading a product link', () => {
  it('reads a Home Depot address', () => {
    const found = readProductLink(
      'https://www.homedepot.com/p/DEWALT-12-in-Double-Bevel-Sliding-Compound-Miter-Saw-DWS779/205183234'
    )!;

    expect(found.retailer).toBe('The Home Depot');
    expect(found.title?.toLowerCase()).toContain('miter saw');
    expect(found.sku).toBe('205183234');
  });

  it('reads a Screwfix address', () => {
    const found = readProductLink('https://www.screwfix.com/p/erbauer-mitre-saw-216mm/1234x')!;
    expect(found.retailer).toBe('Screwfix');
    expect(found.title?.toLowerCase()).toContain('mitre saw');
  });

  it('reads an Amazon address', () => {
    const found = readProductLink('https://www.amazon.co.uk/Bosch-Professional-Mitre-Saw/dp/B08XYZ1234')!;
    expect(found.retailer).toBe('Amazon');
    expect(found.sku).toBe('B08XYZ1234');
  });

  it('still gets a name from a shop it has never heard of', () => {
    // The last part of almost any product path is the product.
    const found = readProductLink('https://tools-r-us.example/store/cordless-impact-driver-18v')!;
    expect(found.retailer).toBeUndefined();
    expect(found.title?.toLowerCase()).toContain('impact driver');
  });

  it('always says the price is missing, because no address contains one', () => {
    // Pretending otherwise is how a budget quietly becomes fiction.
    const found = readProductLink('https://www.homedepot.com/p/Some-Saw/123456')!;
    expect(found.missing).toContain('price');
  });

  it('says the name is missing when the address has nothing to read', () => {
    const found = readProductLink('https://shop.example/12345')!;
    expect(found.title).toBeUndefined();
    expect(found.missing).toContain('name');
  });

  it('drops the tracking rubbish from the link it keeps', () => {
    const found = readProductLink(
      'https://www.homedepot.com/p/Saw/205183234?utm_source=nasty&gclid=abc'
    )!;
    expect(found.url).toBe('https://www.homedepot.com/p/Saw/205183234');
  });

  it('copes with an address pasted without its https', () => {
    expect(readProductLink('screwfix.com/p/some-drill/9999')?.retailer).toBe('Screwfix');
  });

  it('is undefined for something that is not an address', () => {
    expect(readProductLink('a mitre saw please')).toBeUndefined();
    expect(readProductLink('')).toBeUndefined();
  });
});
