import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.controller';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getAllCategories(search?: string) {
    const query = `
      query GetAllCategories($where: item_categories_bool_exp) {
        item_categories(
          where: $where
          order_by: { name: asc }
        ) {
          id
          name
          description
          created_at
          updated_at
          item_sub_categories_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const whereClause = search
      ? {
          _or: [
            { name: { _ilike: `%${search}%` } },
            { description: { _ilike: `%${search}%` } },
          ],
        }
      : {};

    const result = await this.hasuraSystemService.executeQuery(query, {
      where: whereClause,
    });

    return result.item_categories || [];
  }

  async getCategoryById(id: string) {
    const query = `
      query GetCategoryById($id: Int!) {
        item_categories_by_pk(id: $id) {
          id
          name
          description
          created_at
          updated_at
          item_sub_categories_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      id: parseInt(id, 10),
    });
    return result.item_categories_by_pk;
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    // First check if a category with this name already exists
    const checkQuery = `
      query CheckCategoryExists($name: String!) {
        item_categories(where: { name: { _eq: $name } }) {
          id
          name
        }
      }
    `;

    const checkResult = await this.hasuraSystemService.executeQuery(
      checkQuery,
      {
        name: createCategoryDto.name,
      }
    );

    if (checkResult.item_categories && checkResult.item_categories.length > 0) {
      throw new Error(
        `Category with name "${createCategoryDto.name}" already exists`
      );
    }

    const mutation = `
      mutation CreateCategory($name: String!, $description: String!) {
        insert_item_categories_one(object: {
          name: $name,
          description: $description
        }) {
          id
          name
          description
          created_at
          updated_at
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeMutation(mutation, {
        name: createCategoryDto.name,
        description: createCategoryDto.description,
      });

      this.logger.log(
        `Category created: ${result.insert_item_categories_one.name}`
      );
      return result.insert_item_categories_one;
    } catch (error: any) {
      // Handle constraint violation errors
      if (
        error.message &&
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        throw new Error(
          `Category with name "${createCategoryDto.name}" already exists`
        );
      }
      throw error;
    }
  }

  async updateCategory(id: string, updateCategoryDto: UpdateCategoryDto) {
    // If updating the name, check if another category with that name already exists
    if (updateCategoryDto.name !== undefined) {
      const checkQuery = `
        query CheckCategoryExists($name: String!, $excludeId: Int!) {
          item_categories(where: { 
            name: { _eq: $name },
            id: { _neq: $excludeId }
          }) {
            id
            name
          }
        }
      `;

      const checkResult = await this.hasuraSystemService.executeQuery(
        checkQuery,
        {
          name: updateCategoryDto.name,
          excludeId: parseInt(id, 10),
        }
      );

      if (
        checkResult.item_categories &&
        checkResult.item_categories.length > 0
      ) {
        throw new Error(
          `Category with name "${updateCategoryDto.name}" already exists`
        );
      }
    }

    const mutation = `
      mutation UpdateCategory($id: Int!, $name: String, $description: String) {
        update_item_categories_by_pk(
          pk_columns: { id: $id }
          _set: {
            name: $name,
            description: $description,
            updated_at: "now()"
          }
        ) {
          id
          name
          description
          created_at
          updated_at
        }
      }
    `;

    const updateData: any = {};
    if (updateCategoryDto.name !== undefined) {
      updateData.name = updateCategoryDto.name;
    }
    if (updateCategoryDto.description !== undefined) {
      updateData.description = updateCategoryDto.description;
    }

    try {
      const result = await this.hasuraSystemService.executeMutation(mutation, {
        id: parseInt(id, 10),
        ...updateData,
      });

      if (result.update_item_categories_by_pk) {
        this.logger.log(
          `Category updated: ${result.update_item_categories_by_pk.name}`
        );
      }
      return result.update_item_categories_by_pk;
    } catch (error: any) {
      // Handle constraint violation errors
      if (
        error.message &&
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        throw new Error(
          `Category with name "${updateCategoryDto.name}" already exists`
        );
      }
      throw error;
    }
  }

  async deleteCategory(id: string) {
    // First check if category has associated subcategories
    const checkQuery = `
      query CheckCategorySubcategories($id: Int!) {
        item_categories_by_pk(id: $id) {
          id
          name
          item_sub_categories_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const checkResult = await this.hasuraSystemService.executeQuery(
      checkQuery,
      {
        id: parseInt(id, 10),
      }
    );

    const category = checkResult.item_categories_by_pk;
    if (!category) {
      return null;
    }

    if (category.item_sub_categories_aggregate.aggregate.count > 0) {
      throw new Error(
        `Cannot delete category "${category.name}" because it has ${category.item_sub_categories_aggregate.aggregate.count} associated subcategories`
      );
    }

    const mutation = `
      mutation DeleteCategory($id: Int!) {
        delete_item_categories_by_pk(id: $id) {
          id
          name
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      id: parseInt(id, 10),
    });

    if (result.delete_item_categories_by_pk) {
      this.logger.log(
        `Category deleted: ${result.delete_item_categories_by_pk.name}`
      );
    }
    return result.delete_item_categories_by_pk;
  }
}
