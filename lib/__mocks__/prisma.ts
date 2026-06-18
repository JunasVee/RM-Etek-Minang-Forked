export const prisma = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  menuItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  expense: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  stockLog: {
    createMany: jest.fn(),
  },
  restockNotification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}
