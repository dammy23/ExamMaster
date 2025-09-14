const Subject = require('../models/Subject');

class SubjectService {
  // Create a new subject
  async createSubject(subjectData, createdBy) {
    console.log('SubjectService: Creating new subject', { subjectData, createdBy });
    
    try {
      const subject = new Subject({
        ...subjectData,
        createdBy
      });
      
      const savedSubject = await subject.save();
      console.log('SubjectService: Subject created successfully', savedSubject._id);
      
      return savedSubject;
    } catch (error) {
      console.error('SubjectService: Error creating subject', error);
      
      if (error.code === 11000) {
        if (error.keyPattern?.name) {
          throw new Error('A subject with this name already exists');
        }
        if (error.keyPattern?.code) {
          throw new Error('A subject with this code already exists');
        }
        throw new Error('Subject already exists');
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        throw new Error(messages.join(', '));
      }
      
      throw error;
    }
  }

  // Get all subjects
  async getAllSubjects(filters = {}) {
    console.log('SubjectService: Fetching all subjects with filters', filters);
    
    try {
      const query = {};
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      const subjects = await Subject.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      
      console.log('SubjectService: Retrieved subjects count', subjects.length);
      return subjects;
    } catch (error) {
      console.error('SubjectService: Error fetching subjects', error);
      throw error;
    }
  }

  // Get subject by ID
  async getSubjectById(id) {
    console.log('SubjectService: Fetching subject by ID', id);
    
    try {
      const subject = await Subject.findById(id)
        .populate('createdBy', 'name email');
      
      if (!subject) {
        console.log('SubjectService: Subject not found', id);
        throw new Error('Subject not found');
      }
      
      console.log('SubjectService: Subject found', subject._id);
      return subject;
    } catch (error) {
      console.error('SubjectService: Error fetching subject by ID', error);
      
      if (error.message === 'Subject not found') {
        throw error;
      }
      
      if (error.name === 'CastError') {
        throw new Error('Invalid subject ID');
      }
      
      throw error;
    }
  }

  // Update subject
  async updateSubject(id, updateData, userId) {
    console.log('SubjectService: Updating subject', { id, updateData, userId });
    
    try {
      const subject = await Subject.findById(id);
      
      if (!subject) {
        console.log('SubjectService: Subject not found for update', id);
        throw new Error('Subject not found');
      }
      
      // Update the subject
      Object.assign(subject, updateData);
      const updatedSubject = await subject.save();
      
      console.log('SubjectService: Subject updated successfully', updatedSubject._id);
      
      // Populate createdBy for response
      await updatedSubject.populate('createdBy', 'name email');
      
      return updatedSubject;
    } catch (error) {
      console.error('SubjectService: Error updating subject', error);
      
      if (error.code === 11000) {
        if (error.keyPattern?.name) {
          throw new Error('A subject with this name already exists');
        }
        if (error.keyPattern?.code) {
          throw new Error('A subject with this code already exists');
        }
        throw new Error('Subject already exists');
      }
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        throw new Error(messages.join(', '));
      }
      
      if (error.name === 'CastError') {
        throw new Error('Invalid subject ID');
      }
      
      throw error;
    }
  }

  // Delete subject
  async deleteSubject(id, userId) {
    console.log('SubjectService: Deleting subject', { id, userId });
    
    try {
      const subject = await Subject.findById(id);
      
      if (!subject) {
        console.log('SubjectService: Subject not found for deletion', id);
        throw new Error('Subject not found');
      }
      
      await Subject.findByIdAndDelete(id);
      
      console.log('SubjectService: Subject deleted successfully', id);
      
      return { message: 'Subject deleted successfully' };
    } catch (error) {
      console.error('SubjectService: Error deleting subject', error);
      
      if (error.name === 'CastError') {
        throw new Error('Invalid subject ID');
      }
      
      throw error;
    }
  }

  // Get active subjects only (for dropdowns)
  async getActiveSubjects() {
    console.log('SubjectService: Fetching active subjects');
    
    try {
      const subjects = await Subject.find({ isActive: true })
        .select('_id name code description')
        .sort({ name: 1 });
      
      console.log('SubjectService: Retrieved active subjects count', subjects.length);
      return subjects;
    } catch (error) {
      console.error('SubjectService: Error fetching active subjects', error);
      throw error;
    }
  }
}

module.exports = new SubjectService();