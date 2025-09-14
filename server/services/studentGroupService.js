const StudentGroup = require('../models/StudentGroup.js');
const User = require('../models/User.js');

class StudentGroupService {
  // Get all student groups
  static async getAllGroups() {
    try {
      console.log('StudentGroupService: Getting all student groups...');
      
      // Get all groups and recalculate student counts
      const groups = await StudentGroup.find().sort({ createdAt: -1 });
      
      // Update student counts for each group
      for (const group of groups) {
        const studentCount = await User.countDocuments({ 
          group: group.name, 
          role: 'student' 
        });
        if (group.studentCount !== studentCount) {
          group.studentCount = studentCount;
          await group.save();
        }
      }
      
      console.log(`StudentGroupService: Found ${groups.length} student groups`);
      return groups;
    } catch (error) {
      console.error('StudentGroupService: Error getting student groups:', error.message);
      throw new Error('Failed to retrieve student groups');
    }
  }

  // Get group by ID
  static async getGroupById(groupId) {
    try {
      console.log(`StudentGroupService: Getting group by ID: ${groupId}`);
      const group = await StudentGroup.findById(groupId);
      
      if (!group) {
        console.log(`StudentGroupService: Group not found with ID: ${groupId}`);
        throw new Error('Student group not found');
      }
      
      // Update student count
      const studentCount = await User.countDocuments({ 
        group: group.name, 
        role: 'student' 
      });
      if (group.studentCount !== studentCount) {
        group.studentCount = studentCount;
        await group.save();
      }
      
      console.log(`StudentGroupService: Found group: ${group.name}`);
      return group;
    } catch (error) {
      console.error(`StudentGroupService: Error getting group by ID ${groupId}:`, error.message);
      throw error;
    }
  }

  // Create new student group
  static async createGroup(groupData) {
    try {
      console.log(`StudentGroupService: Creating student group: ${groupData.name}`);
      console.log('StudentGroupService: Group data:', groupData);

      // Check if group with same name already exists
      const existingGroup = await StudentGroup.findOne({ 
        name: { $regex: new RegExp(`^${groupData.name}$`, 'i') }
      });
      
      if (existingGroup) {
        console.log(`StudentGroupService: Group already exists with name: ${groupData.name}`);
        throw new Error('Student group with this name already exists');
      }

      const group = new StudentGroup({
        name: groupData.name,
        description: groupData.description || '',
        status: groupData.status || 'active'
      });

      console.log('StudentGroupService: Saving group to database...');
      const savedGroup = await group.save();
      console.log(`StudentGroupService: Group saved successfully with ID: ${savedGroup._id}`);

      return savedGroup;
    } catch (error) {
      console.error(`StudentGroupService: Error creating group ${groupData.name}:`, error.message);
      console.error('StudentGroupService: Full error:', error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        throw new Error('Student group with this name already exists');
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new Error(validationErrors.join(', '));
      }
      
      throw error;
    }
  }

  // Update student group
  static async updateGroup(groupId, updateData) {
    try {
      console.log(`StudentGroupService: Updating group with ID: ${groupId}`);
      console.log('StudentGroupService: Update data:', updateData);
      
      const oldGroup = await StudentGroup.findById(groupId);
      if (!oldGroup) {
        throw new Error('Student group not found');
      }

      const updatedGroup = await StudentGroup.findByIdAndUpdate(
        groupId,
        updateData,
        { new: true, runValidators: true }
      );

      // If group name was changed, update all students in this group
      if (updateData.name && updateData.name !== oldGroup.name) {
        console.log(`StudentGroupService: Updating students from group "${oldGroup.name}" to "${updateData.name}"`);
        
        await User.updateMany(
          { group: oldGroup.name, role: 'student' },
          { group: updateData.name }
        );
      }

      // Recalculate student count
      const studentCount = await User.countDocuments({ 
        group: updatedGroup.name, 
        role: 'student' 
      });
      updatedGroup.studentCount = studentCount;
      await updatedGroup.save();

      console.log(`StudentGroupService: Group updated successfully: ${updatedGroup.name}`);
      return updatedGroup;
    } catch (error) {
      console.error(`StudentGroupService: Error updating group ${groupId}:`, error.message);
      throw error;
    }
  }

  // Delete student group
  static async deleteGroup(groupId) {
    try {
      console.log(`StudentGroupService: Deleting group with ID: ${groupId}`);
      
      const group = await StudentGroup.findById(groupId);
      if (!group) {
        throw new Error('Student group not found');
      }

      // Check if there are students in this group
      const studentCount = await User.countDocuments({ 
        group: group.name, 
        role: 'student' 
      });

      if (studentCount > 0) {
        throw new Error(`Cannot delete group "${group.name}" because it contains ${studentCount} student(s). Please reassign or remove the students first.`);
      }

      await StudentGroup.findByIdAndDelete(groupId);
      console.log(`StudentGroupService: Group deleted successfully: ${group.name}`);
      
      return { message: 'Student group deleted successfully' };
    } catch (error) {
      console.error(`StudentGroupService: Error deleting group ${groupId}:`, error.message);
      throw error;
    }
  }

  // Get students in a specific group
  static async getStudentsInGroup(groupName) {
    try {
      console.log(`StudentGroupService: Getting students in group: ${groupName}`);
      
      const students = await User.find({ 
        group: groupName, 
        role: 'student' 
      }).select('-password').sort({ createdAt: -1 });
      
      console.log(`StudentGroupService: Found ${students.length} students in group: ${groupName}`);
      return students;
    } catch (error) {
      console.error(`StudentGroupService: Error getting students in group ${groupName}:`, error.message);
      throw new Error('Failed to retrieve students in group');
    }
  }
}

module.exports = StudentGroupService;