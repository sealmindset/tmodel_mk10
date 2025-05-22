/**
 * Subjects API Routes
 * 
 * This file provides API endpoints to access the threat models stored in PostgreSQL
 * as subjects, which are displayed on the /models page.
 */
const express = require('express');
const router = express.Router();

const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route   GET /api/subjects
 * @desc    Get all subjects (threat models) from PostgreSQL
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get all subjects from PostgreSQL
    const subjectKeys = await client.keys('subject:*:title');
    
    // Create a list of promises to fetch subject details
    const subjectsPromises = subjectKeys.map(async (key) => {
      // Extract subject ID from the key pattern subject:$id:title
      const subjectid = key.split(':')[1];
      
      // Get subject title
      const title = await client.get(key);
      
      // Get model used (if available)
      const model = await client.get(`subject:${subjectid}:model`) || 'Unknown';
      
      // Get creation date (if available)
      let createdAt;
      try {
        createdAt = await client.get(`subject:${subjectid}:createdAt`);
        if (!createdAt) {
          // If no creation date is stored, use current time
          createdAt = new Date().toISOString();
        }
      } catch (err) {
        createdAt = new Date().toISOString();
      }

      // Get response text to count threats
      let threatCount = 0;
      try {
        const responseText = await client.get(`subject:${subjectid}:response`);
        if (responseText) {
          // Use the same pattern as the View Threats functionality
          const threatPattern = /## (.*?)\n/g;
          let match;
          let matches = [];
          
          // Count all matches of the pattern
          while ((match = threatPattern.exec(responseText)) !== null) {
            matches.push(match[1]);
          }
          
          threatCount = matches.length;
        }
      } catch (err) {
        console.error(`Error getting threat count for subject ${subjectid}:`, err);
      }
      
      return {
        subjectid,
        title,
        model,
        createdAt,
        threatCount
      };
    });
    
    // Resolve all promises to get subject details
    let subjects = await Promise.all(subjectsPromises);
    
    // Sort by creation date (newest first)
    subjects = subjects.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.json({ 
      success: true, 
      subjects,
      count: subjects.length
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subjects',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/subjects/:id
 * @desc    Get a specific subject (threat model) from PostgreSQL
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if subject exists
    const title = await client.get(`subject:${id}:title`);
    
    if (!title) {
      return res.status(404).json({ 
        success: false, 
        error: 'Subject not found' 
      });
    }
    
    // Get subject details
    const text = await client.get(`subject:${id}:text`);
    const response = await client.get(`subject:${id}:response`);
    const model = await client.get(`subject:${id}:model`) || 'Unknown';
    const createdAt = await client.get(`subject:${id}:createdAt`) || new Date().toISOString();
    
    // Count threats in the response
    let threatCount = 0;
    if (response) {
      const threatPattern = /## (.*?)\n/g;
      let match;
      let matches = [];
      
      // Count all matches of the pattern
      while ((match = threatPattern.exec(response)) !== null) {
        matches.push(match[1]);
      }
      
      threatCount = matches.length;
    }
    
    res.json({
      success: true,
      subject: {
        subjectid: id,
        title,
        text,
        response,
        model,
        createdAt,
        threatCount
      }
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subject',
      details: error.message
    });
  }
});

module.exports = router;
