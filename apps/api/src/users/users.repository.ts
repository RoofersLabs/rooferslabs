import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Data-access for the User entity. Contains no business rules. */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { clerkUserId, deletedAt: null } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findManyByCompany(companyId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  updateLastActive(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { lastActiveAt: new Date() } });
  }
}
