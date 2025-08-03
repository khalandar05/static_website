const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');

// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { category, brand, minPrice, maxPrice, search, sort } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = { $text: { $search: search } };
    }
    
    // Build sort object
    let sortObj = { createdAt: -1 };
    if (sort) {
      switch (sort) {
        case 'price_asc':
          sortObj = { price: 1 };
          break;
        case 'price_desc':
          sortObj = { price: -1 };
          break;
        case 'name_asc':
          sortObj = { name: 1 };
          break;
        case 'rating_desc':
          sortObj = { ratings: -1 };
          break;
      }
    }
    
    const products = await Product.find({ ...filter, ...searchQuery })
      .sort(sortObj)
      .limit(limit)
      .skip(skip)
      .populate('user', 'name');
    
    const total = await Product.countDocuments({ ...filter, ...searchQuery });
    
    res.json({
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('user', 'name')
      .populate('reviews.user', 'name avatar');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products
// @desc    Create a product
// @access  Private (Admin)
router.post('/', [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('category').isIn(['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Other']).withMessage('Valid category is required'),
  body('brand').trim().isLength({ min: 1 }).withMessage('Brand is required'),
  body('stock').isInt({ min: 0 }).withMessage('Valid stock quantity is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      images,
      stock,
      sku,
      weight,
      dimensions,
      tags
    } = req.body;

    // Generate SKU if not provided
    const productSku = sku || `${category.substring(0, 3).toUpperCase()}-${Date.now()}`;

    const product = new Product({
      name,
      description,
      price,
      compareAtPrice,
      category,
      brand,
      images: images || [],
      stock,
      sku: productSku,
      weight,
      dimensions,
      tags,
      user: req.user.id // This will be set by auth middleware
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product
// @access  Private (Admin)
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is admin or product owner
    if (req.user.role !== 'admin' && product.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product
// @access  Private (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is admin or product owner
    if (req.user.role !== 'admin' && product.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    await product.remove();
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products/:id/reviews
// @desc    Create product review
// @access  Private
router.post('/:id/reviews', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 10 }).withMessage('Comment must be at least 10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === req.user.id
    );
    
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }
    
    const review = {
      user: req.user.id,
      name: req.user.name,
      rating: Number(req.body.rating),
      comment: req.body.comment
    };
    
    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;
    product.ratings = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;
    
    await product.save();
    res.status(201).json({ message: 'Review added' });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 