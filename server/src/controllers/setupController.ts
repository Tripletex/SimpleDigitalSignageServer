import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import sequelize, { testConnection } from '../config/database';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { TenantMember } from '../models/TenantMember';
import { QueryTypes } from 'sequelize';
import { UserRole } from '../../../shared/src/userData';
import { Model, HasMany } from 'sequelize-typescript';

class SetupController {
  /**
   * Check database connection and server status
   */
  public healthCheck = handleErrors(async (req: Request, res: Response): Promise<void> => {
    try {
      // Test database connection
      const dbConnected = await testConnection();
      
      // Check for tables (run a query to get all table names)
      const tables = await sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", 
        { type: QueryTypes.SELECT }
      );
      
      // Get counts for key tables
      const [
        userCount, 
        tenantCount, 
        tenantMemberCount,
        deviceCount
      ] = await Promise.all([
        sequelize.query("SELECT COUNT(*) FROM users", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT COUNT(*) FROM tenants", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT COUNT(*) FROM tenant_members", { type: QueryTypes.SELECT }),
        sequelize.query("SELECT COUNT(*) FROM devices", { type: QueryTypes.SELECT })
      ]);
      
      res.json({
        success: true,
        status: 'Server is running',
        database: {
          connected: dbConnected,
          tables: tables,
          counts: {
            users: (userCount[0] as any).count,
            tenants: (tenantCount[0] as any).count,
            tenantMembers: (tenantMemberCount[0] as any).count,
            devices: (deviceCount[0] as any).count
          }
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          dbHost: process.env.DB_HOST || 'localhost',
          dbName: process.env.DB_NAME || 'signage'
        },
        version: '1.0.0'
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
  
  /**
   * Debug tenant relationships for a specific user
   */
  public debugUserTenants = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      const userId = req.user.id;
      
      // Get user details
      const user = await sequelize.query(
        `SELECT * FROM users WHERE id = :userId`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT
        }
      );
      
      // Get all tenants
      const tenants = await sequelize.query(
        `SELECT * FROM tenants`,
        { type: QueryTypes.SELECT }
      );
      
      // Get tenant members for this user
      const tenantMembers = await sequelize.query(
        `SELECT * FROM tenant_members WHERE user_id = :userId`,
        { 
          replacements: { userId },
          type: QueryTypes.SELECT
        }
      );
      
      // Get personal tenants
      const personalTenants = await sequelize.query(
        `SELECT * FROM tenants WHERE is_personal = true`,
        { type: QueryTypes.SELECT }
      );
      
      // Get all tenant members
      const allTenantMembers = await sequelize.query(
        `SELECT * FROM tenant_members`,
        { type: QueryTypes.SELECT }
      );
      
      res.json({
        success: true,
        debug: {
          user,
          tenants,
          tenantMembers,
          personalTenants,
          allTenantMembers,
          counts: {
            totalTenants: tenants.length,
            personalTenants: personalTenants.length,
            userTenantMemberships: tenantMembers.length,
            allTenantMembers: allTenantMembers.length
          }
        }
      });
    } catch (error) {
      console.error('Debug tenant error:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
  
  /**
   * Debug endpoint to check all tenants in the system with Sequelize models
   */
  public debugTenantsWithModels = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      // Get all tenants
      const tenants = await Tenant.findAll({
        include: [
          {
            model: User,
            as: 'owner'
          },
          {
            model: TenantMember,
            include: [
              {
                model: User,
                as: 'user'
              }
            ]
          }
        ]
      });
      
      // Format the results
      const formattedTenants = tenants.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        isPersonal: tenant.isPersonal,
        ownerId: tenant.ownerId,
        ownerEmail: tenant.owner?.email,
        createdAt: tenant.createdAt,
        members: tenant.members?.map(member => ({
          id: member.id,
          userId: member.userId,
          userEmail: member.user?.email,
          userDisplayName: member.user?.displayName,
          role: member.role,
          status: member.status
        })) || []
      }));
      
      res.json({
        success: true,
        tenantCount: tenants.length,
        tenants: formattedTenants
      });
    } catch (error) {
      console.error('Debug tenants with models error:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
  
  /**
   * Debug endpoint to check all users and their tenants with Sequelize models
   */
  public debugUsersWithModels = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      // Get all users directly with raw SQL since model associations might be the issue
      const rawUsers = await sequelize.query(
        `SELECT u.* FROM users u`,
        { type: QueryTypes.SELECT }
      );
      
      // Manually find tenant memberships for each user
      const users = await Promise.all((rawUsers as any[]).map(async (rawUser) => {
        const user = new User(rawUser);
        
        // Get tenant memberships separately
        const memberships = await TenantMember.findAll({
          where: { userId: user.id },
          include: [{ model: Tenant }]
        });
        
        // Attach memberships to user object
        (user as any).tenantMemberships = memberships;
        
        return user;
      }));
      
      // Format the results
      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.role === UserRole.ADMIN,
        tenantMemberships: ((user as any).tenantMemberships || []).map((membership: any) => ({
          id: membership.id,
          tenantId: membership.tenantId,
          tenantName: membership.tenant?.name,
          isPersonal: membership.tenant?.isPersonal,
          role: membership.role,
          status: membership.status
        }))
      }));
      
      res.json({
        success: true,
        userCount: users.length,
        users: formattedUsers
      });
    } catch (error) {
      console.error('Debug users with models error:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
  
  /**
   * Verify model associations
   */
  public verifyAssociations = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      // Get the current user
      const userId = req.user.id;
      
      // Get user directly
      const user = await User.findByPk(userId);
      
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      
      // Manually get tenant memberships
      const tenantMemberships = await TenantMember.findAll({
        where: { userId },
        include: [{ model: Tenant }]
      });
      
      // Attach to user
      (user as any).tenantMemberships = tenantMemberships;
      
      // Check for personal tenant
      const personalTenant = await Tenant.findOne({
        where: {
          ownerId: userId,
          isPersonal: true
        }
      });
      
      // Check for tenant membership
      const personalTenantMembership = personalTenant
        ? await TenantMember.findOne({
            where: {
              tenantId: personalTenant.id,
              userId: userId
            }
          })
        : null;
        
      // Check reverse association - tenant's members
      const tenantWithMembers = personalTenant
        ? await Tenant.findByPk(personalTenant.id, {
            include: [
              {
                model: TenantMember,
                where: { userId }
              }
            ]
          })
        : null;
        
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          membershipsLoaded: !!(user as any).tenantMemberships,
          membershipCount: (user as any).tenantMemberships?.length || 0
        },
        personalTenant: personalTenant 
          ? {
              id: personalTenant.id,
              name: personalTenant.name,
              ownerId: personalTenant.ownerId
            }
          : null,
        personalTenantMembership: personalTenantMembership
          ? {
              id: personalTenantMembership.id,
              userId: personalTenantMembership.userId,
              tenantId: personalTenantMembership.tenantId,
              role: personalTenantMembership.role,
              status: personalTenantMembership.status
            }
          : null,
        reverseAssociation: {
          loaded: !!tenantWithMembers,
          membersCount: (tenantWithMembers as any)?.members?.length || 0
        }
      });
    } catch (error) {
      console.error('Verify associations error:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
  
  /**
   * Reset users in development mode
   * WARNING: This is a destructive operation that should only be used in development
   */
  public resetUsers = handleErrors(async (req: Request, res: Response): Promise<void> => {
    // Only allowed in development
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({ success: false, message: 'This endpoint is only available in development mode' });
      return;
    }
    
    try {
      // First, delete all tenant memberships
      await TenantMember.destroy({ where: {} });
      console.log('Deleted all tenant memberships');
      
      // Delete all tenants
      await Tenant.destroy({ where: {} });
      console.log('Deleted all tenants');
      
      // Delete all authenticators
      await sequelize.query('DELETE FROM authenticators');
      console.log('Deleted all authenticators');
      
      // Delete all users
      await User.destroy({ where: {} });
      console.log('Deleted all users');
      
      res.json({
        success: true,
        message: 'All users, tenants, and related data have been reset',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error resetting users:', error);
      res.status(500).json({
        success: false,
        error: String(error)
      });
    }
  });
}

export default new SetupController();